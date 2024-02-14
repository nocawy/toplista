from django.urls import path
from .views import SongList
from .views import update_rank
from .views import UploadCSV

urlpatterns = [
    path('songs/', SongList.as_view()),
    path('update/rank/', update_rank),
    path('upload-csv/', UploadCSV.as_view()),
]
