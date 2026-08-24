from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Song


class AddSongTransactionTests(TestCase):
    @patch("api.views.RankingEntry.objects.create", side_effect=IntegrityError)
    def test_failed_membership_creation_does_not_leave_orphan_song(self, _mock_create):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor"))

        response = client.post(
            "/api/songs/add/?list=main",
            {"s_yt_id": "lmnopqrstuv", "s_title": "New song"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Song.objects.filter(s_yt_id="lmnopqrstuv").exists())
