from rest_framework import generics
from .models import Song
from .serializers import SongSerializer

class SongList(generics.ListAPIView):
    queryset = Song.objects.all().order_by('rank__r_rank')
    serializer_class = SongSerializer
