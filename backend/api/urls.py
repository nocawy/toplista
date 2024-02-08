from django.urls import path
from .views import hello_world
from .views import SongList

urlpatterns = [
    path('hello/', hello_world),
    path('songs/', SongList.as_view(), name='song-list'),
]
