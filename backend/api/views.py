# views.py
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.db.models import F, Max
from django.http import JsonResponse
import json
import os

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Song, Ranking, RankingEntry
from .serializers import LoginSerializer, SongSerializer, RankingSerializer


def _get_selected_ranking(request) -> Ranking:
    """Resolve ranking from query params; default to 'main'."""
    slug = request.GET.get("list") or request.GET.get("ranking") or "main"
    ranking, _ = Ranking.objects.get_or_create(slug=slug, defaults={"name": slug})
    return ranking


class SongList(generics.ListAPIView):
    serializer_class = SongSerializer

    def get_queryset(self):
        ranking = _get_selected_ranking(self.request)
        # Return songs that belong to the selected ranking, annotated with r_rank
        return (
            Song.objects.filter(memberships__ranking=ranking)
            .annotate(r_rank=F("memberships__r_rank"))
            .order_by("r_rank")
        )


@api_view(["GET"])
def song_lookup(request):
    """Lookup a global song by yt_id. Returns 200 with Song data or 404 if not found."""
    yt_id = request.GET.get("yt_id")
    if not yt_id:
        return JsonResponse({"detail": "yt_id is required"}, status=400)
    song = Song.objects.filter(s_yt_id=yt_id).first()
    if not song:
        return JsonResponse({"detail": "not found"}, status=404)
    return JsonResponse(SongSerializer(song).data, safe=False)


class RankingList(generics.ListCreateAPIView):
    queryset = Ranking.objects.all().order_by("created_on")
    serializer_class = RankingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class RankingDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Ranking.objects.all()
    serializer_class = RankingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_destroy(self, instance: Ranking) -> None:
        # Delete the ranking (cascades to RankingEntry), then cleanup orphan Songs
        with transaction.atomic():
            super().perform_destroy(instance)
            Song.objects.filter(memberships__isnull=True).delete()


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
            ranking = _get_selected_ranking(request)

            # Ensure newRank stays within [1, total_songs]
            total_songs = RankingEntry.objects.filter(ranking=ranking).count()
            newRank: int = data["newRank"]
            if newRank < 1:
                newRank = 1
            elif newRank > total_songs:
                newRank = total_songs

            # Retrieve the ranking entry for the provided song within the selected ranking
            with transaction.atomic():
                entry = RankingEntry.objects.select_for_update().get(ranking=ranking, song__id=data["songId"])
                oldRank: int = entry.r_rank

                if oldRank == newRank:
                    return JsonResponse({"status": "success", "song_id": entry.song.id, "r_rank": entry.r_rank})

                TEMP_SHIFT = 1_000_000

                if oldRank < newRank:
                    # Bump the affected range far away to create space
                    RankingEntry.objects.filter(ranking=ranking, r_rank__gt=oldRank, r_rank__lte=newRank).update(
                        r_rank=F("r_rank") + TEMP_SHIFT
                    )

                    # Place the entry into target slot
                    entry.r_rank = newRank
                    entry.save(update_fields=["r_rank"])

                    # Collapse the bumped range back by TEMP_SHIFT+1, effectively shifting -1
                    RankingEntry.objects.filter(
                        ranking=ranking, r_rank__gt=oldRank + TEMP_SHIFT, r_rank__lte=newRank + TEMP_SHIFT
                    ).update(r_rank=F("r_rank") - (TEMP_SHIFT + 1))
                else:
                    # Bump the affected range far away to create space
                    RankingEntry.objects.filter(ranking=ranking, r_rank__gte=newRank, r_rank__lt=oldRank).update(
                        r_rank=F("r_rank") + TEMP_SHIFT
                    )

                    # Place the entry into target slot
                    entry.r_rank = newRank
                    entry.save(update_fields=["r_rank"])

                    # Collapse the bumped range back by TEMP_SHIFT-1, effectively shifting +1
                    RankingEntry.objects.filter(
                        ranking=ranking, r_rank__gte=newRank + TEMP_SHIFT, r_rank__lt=oldRank + TEMP_SHIFT
                    ).update(r_rank=F("r_rank") - (TEMP_SHIFT - 1))

            return JsonResponse({"status": "success", "song_id": entry.song.id, "r_rank": entry.r_rank})
        except RankingEntry.DoesNotExist:
            return JsonResponse({"status": "error", "message": "Song is not part of the selected ranking"}, status=404)
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
                # Choose ranking from query params, default to 'main'
                ranking = _get_selected_ranking(request)
                call_command("import_songs", file_path, ranking=ranking.slug)
                return JsonResponse({"status": "success"}, status=200)
            except Exception as e:
                return JsonResponse({"status": "error", "message": str(e)}, status=500)

        else:
            return JsonResponse({"status": "error", "message": "No file provided"}, status=400)


class AddSong(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        ranking = _get_selected_ranking(request)

        data = request.data.copy()
        yt_id = data.get("s_yt_id")
        if not yt_id:
            return Response({"s_yt_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        # Try to find existing song by yt_id
        existing = Song.objects.filter(s_yt_id=yt_id).first()
        if existing:
            song = existing
        else:
            serializer = SongSerializer(data=data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            try:
                song = serializer.save()
            except IntegrityError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Now attach to ranking with next rank
        try:
            with transaction.atomic():
                if RankingEntry.objects.filter(ranking=ranking, song=song).exists():
                    return Response(
                        {"error": "Song already exists in this ranking."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                highest = RankingEntry.objects.filter(ranking=ranking).aggregate(Max("r_rank"))["r_rank__max"] or 0
                new_rank_value = highest + 1
                RankingEntry.objects.create(ranking=ranking, song=song, r_rank=new_rank_value)
        except IntegrityError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Return the created/attached song representation
        return Response(SongSerializer(song).data, status=status.HTTP_201_CREATED)


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
    ranking = _get_selected_ranking(request)
    try:
        with transaction.atomic():
            song = Song.objects.get(pk=pk)
            # Remove only from the selected ranking
            entry = RankingEntry.objects.get(ranking=ranking, song=song)
            deleted_rank = entry.r_rank
            entry.delete()

            # Update ranks of remaining songs in this ranking
            RankingEntry.objects.filter(ranking=ranking, r_rank__gt=deleted_rank).update(r_rank=F("r_rank") - 1)

            # If song is no longer used in any ranking, delete it
            if not song.memberships.exists():
                song.delete()

        return JsonResponse(
            {"status": "success", "message": f"Song with id {pk} removed from ranking {ranking.slug}."},
            status=status.HTTP_204_NO_CONTENT,
        )
    except Song.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Song not found."}, status=status.HTTP_404_NOT_FOUND)
    except RankingEntry.DoesNotExist:
        return JsonResponse(
            {"status": "error", "message": "Song is not in this ranking."}, status=status.HTTP_404_NOT_FOUND
        )
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
