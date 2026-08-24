from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Ranking, RankingEntry, Song


class RankUpdateValidationTests(TestCase):
    def test_rank_update_rejects_non_integer_rank(self):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor"))
        ranking = Ranking.objects.get(slug="main")
        song = Song.objects.create(s_yt_id="abcdefghijk", s_title="Song")
        RankingEntry.objects.create(ranking=ranking, song=song, r_rank=1)

        response = client.patch(
            "/api/update/rank/?list=main",
            {"songId": song.id, "newRank": "bad"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
