from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Ranking


class RankingReadTests(TestCase):
    def test_unknown_ranking_read_does_not_create_database_row(self):
        initial_count = Ranking.objects.count()

        response = self.client.get("/api/songs/?list=does-not-exist")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Ranking.objects.count(), initial_count)


class RankingSlugValidationTests(TestCase):
    def test_ranking_update_rejects_blank_slug(self):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor"))
        ranking = Ranking.objects.get(slug="main")

        response = client.patch(
            f"/api/rankings/{ranking.id}/",
            {"slug": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
