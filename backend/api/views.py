# views.py
from django.core.management import call_command
from django.db import IntegrityError
from django.db.models import F, Max
from django.http import JsonResponse
import json
import os

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Rank, Song
from .serializers import LoginSerializer, SongSerializer


class SongList(generics.ListAPIView):
    queryset = Song.objects.all().order_by("rank__r_rank")
    serializer_class = SongSerializer


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_rank(request):
    """
    Updates the ranking of a song based on the provided song ID and new rank.

    This function shifts the ranks of all songs affected in the process to maintain
    a consistent and gapless ranking order. It handles the rank adjustment logic
    to ensure that all songs between the old and new rank of the updated song
    are correctly re-ranked.

    This endpoint expects a PATCH request with a JSON body.
    Expected JSON request format:
    {
        "songId": <int>,  # The ID of the song to update
        "newRank": <int>  # The new rank to assign to the song
    }

    Returns:
    - A JSON response with a status of 'success' and the updated rank information
      if the operation is successful.
    - A JSON response with a status of 'error' and an error message if the operation
      fails due to reasons such as missing request keys, the song not existing, etc.
    """
    if request.method == "PATCH":
        try:
            data = json.loads(request.body)

            # Ensure newRank stays within [1, total_songs]
            total_songs = Song.objects.count()
            newRank: int = data["newRank"]
            if newRank < 1:
                newRank = 1
            elif newRank > total_songs:
                newRank = total_songs

            # Retrieve the rank object based on the song ID provided in the request
            rank = Rank.objects.get(song__id=data["songId"])
            oldRank: int = rank.r_rank

            # If the new rank is higher than the old rank, decrement ranks between them
            if oldRank < newRank:
                ranks_to_update = Rank.objects.filter(r_rank__range=(oldRank + 1, newRank))
                ranks_to_update.update(r_rank=F("r_rank") - 1)
            # If the new rank is lower than the old rank, increment ranks between them
            elif oldRank > newRank:
                ranks_to_update = Rank.objects.filter(r_rank__range=(newRank, oldRank - 1))
                ranks_to_update.update(r_rank=F("r_rank") + 1)

            # Update this song's rank only after shifting others within the new/old rank range
            rank.r_rank = newRank
            rank.save()
            return JsonResponse({"status": "success", "song_id": rank.song.id, "r_rank": rank.r_rank})
        except Rank.DoesNotExist:
            return JsonResponse(
                {"status": "error", "message": "Rank for the specified song does not exist"}, status=404
            )
        except KeyError as e:
            return JsonResponse({"status": "error", "message": f"Missing key in request: {str(e)}"}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Invalid request method"}, status=405)


class UploadCSV(APIView):
    """
    A view that handles CSV file uploads for importing songs into the database via POST requests.

    This class uses the MultiPartParser and FormParser to handle file uploads
    in multipart/form-data format. It expects a POST request with a file named 'file'.
    Upon receiving the file, it checks the file size.
    If the size is within limits, it saves the file to a backup directory and calls
    the 'import_songs' Django management command to import the songs from the CSV into
    the database.

    If the import is successful, it returns a JSON response with a status of 'success'.
    If an error occurs during the import process, it returns a JSON response with a status
    of 'error' and an error message. If no file is provided or the file is too large,
    it returns an error message accordingly.
    """

    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        csv_file = request.FILES.get("file")
        if csv_file:
            if csv_file.size > 1048576:  # 1MB
                return JsonResponse({"error": "The file is too large. The maximum size is 1MB."}, status=400)
            backup_dir = ".backup"
            os.makedirs(backup_dir, exist_ok=True)  # Ensure the backup directory exists
            file_path = os.path.join(backup_dir, "songs_import.csv")

            with open(file_path, "wb+") as destination:
                for chunk in csv_file.chunks():
                    destination.write(chunk)

            try:
                call_command("import_songs", file_path)
                return JsonResponse({"status": "success"}, status=200)
            except Exception as e:
                return JsonResponse({"status": "error", "message": str(e)}, status=500)

        else:
            return JsonResponse({"status": "error", "message": "No file provided"}, status=400)


class AddSong(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = SongSerializer(data=request.data)
        if serializer.is_valid():
            try:
                song = serializer.save()
                # Retrieve the highest current rank and calculate the new rank
                highest_rank = Rank.objects.aggregate(Max("r_rank"))["r_rank__max"] or 0
                new_rank_value = highest_rank + 1
                # Create a Rank instance for the new song
                Rank.objects.create(song=song, r_rank=new_rank_value)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError as e:
                # Handle possible integrity errors, e.g., unique constraint violation
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Include both serializer errors and any additional error messages
            errors = serializer.errors
            # errors.update({'additional_error': 'Custom error message or additional info'})
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_song(request, pk):
    try:
        song = Song.objects.get(pk=pk)
    except Song.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = SongSerializer(song, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return JsonResponse(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_song(request, pk):
    try:
        # Find the song to be deleted
        song = Song.objects.get(pk=pk)
        rank_to_delete = song.rank.r_rank
        song.delete()

        # Update the ranking of the remaining songs that had a higher ranking
        Rank.objects.filter(r_rank__gt=rank_to_delete).update(r_rank=F("r_rank") - 1)

        return JsonResponse(
            {"status": "success", "message": f"Song with id {pk} deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )
    except Song.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Song not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginAPIView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            user = serializer.validated_data
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
