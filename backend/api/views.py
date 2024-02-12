from rest_framework import generics
from .models import Song
from .serializers import SongSerializer

class SongList(generics.ListAPIView):
    queryset = Song.objects.all().order_by('rank__r_rank')
    serializer_class = SongSerializer


from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from django.db.models import F
from .models import Rank

@csrf_exempt
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
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            # Retrieve the rank object based on the song ID provided in the request
            rank = Rank.objects.get(song__id=data['songId'])
            oldRank: int = rank.r_rank
            newRank: int = data['newRank']

            # If the new rank is higher than the old rank, decrement ranks between them
            if oldRank < newRank:
                ranks_to_update = Rank.objects.filter(r_rank__range=(oldRank + 1, newRank))
                ranks_to_update.update(r_rank=F('r_rank') - 1)
            # If the new rank is lower than the old rank, increment ranks between them
            elif oldRank > newRank:
                ranks_to_update = Rank.objects.filter(r_rank__range=(newRank, oldRank - 1))
                ranks_to_update.update(r_rank=F('r_rank') + 1)

            # Update this song's rank only after shifting others within the new/old rank range
            rank.r_rank = newRank
            rank.save()
            return JsonResponse({'status': 'success', 'song_id': rank.song.id, 'r_rank': rank.r_rank})
        except Rank.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Rank for the specified song does not exist'}, status=404)
        except KeyError as e:
            return JsonResponse({'status': 'error', 'message': f'Missing key in request: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)
