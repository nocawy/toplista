from django.urls import path
from .views import SongList
from .views import update_rank

urlpatterns = [
    path('songs/', SongList.as_view()),
    path('update/rank/', update_rank),
]
