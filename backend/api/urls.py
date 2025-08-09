# urls.py
from django.urls import path
from .views import SongList
from .views import update_rank
from .views import UploadCSV
from .views import AddSong
from .views import update_song
from .views import delete_song
from .views import LoginAPIView
from .views import song_lookup
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('songs/', SongList.as_view()),  # accepts ?list=<slug>
    path('songs/lookup/', song_lookup),
    path('update/rank/', update_rank),   # accepts ?list=<slug>
    path('upload-csv/', UploadCSV.as_view()),
    path('songs/add/', AddSong.as_view()),
    path('songs/update/<int:pk>', update_song, name='update_song'),
    path('songs/delete/<int:pk>/', delete_song, name='delete_song'),  # accepts ?list=<slug>
    path('login/', LoginAPIView.as_view(), name='api_login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
