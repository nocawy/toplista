from django.urls import path
from .views import SongList

urlpatterns = [
    path('songs/', SongList.as_view()),
]
