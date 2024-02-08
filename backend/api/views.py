from django.shortcuts import render


from django.http import JsonResponse

def hello_world(request):
    return JsonResponse({'message': 'hello world!!'})


from rest_framework import generics
from .models import Song
from .serializers import SongSerializer

class SongList(generics.ListAPIView):
    queryset = Song.objects.all()
    serializer_class = SongSerializer
