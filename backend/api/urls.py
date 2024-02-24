# urls.py
from django.urls import path
from .views import SongList
from .views import update_rank
from .views import UploadCSV
from .views import AddSong
from .views import update_song
from .views import delete_song
from .views import LoginAPIView

urlpatterns = [
    path('songs/', SongList.as_view()),
    path('update/rank/', update_rank),
    path('upload-csv/', UploadCSV.as_view()),
    path('songs/add/', AddSong.as_view()),
    path('songs/update/<int:pk>', update_song, name='update_song'),
    path('songs/delete/<int:pk>/', delete_song, name='delete_song'),
    path('login/', LoginAPIView.as_view(), name='api_login'),
]
