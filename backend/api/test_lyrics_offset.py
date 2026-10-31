from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .lyrics.service import result_to_payload
from .lyrics.types import LyricLine, LyricsResult
from .models import Song


class SongLyricsOffsetTests(TestCase):
    def setUp(self):
        self.song = Song.objects.create(s_yt_id="abcdefghijk", s_title="Song")
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user(username="editor"))

    def test_new_songs_have_no_offset(self):
        self.assertEqual(self.song.s_lyrics_offset_ms, 0)
        self.assertEqual(self.song.s_lyrics_offset_ref, "")

    def test_saves_offset_with_lyrics_fingerprint(self):
        response = self.client.patch(
            f"/api/songs/update/{self.song.id}",
            {"s_lyrics_offset_ms": 17_000, "s_lyrics_offset_ref": "0123456789abcdef"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["s_lyrics_offset_ms"], 17_000)
        self.song.refresh_from_db()
        self.assertEqual(self.song.s_lyrics_offset_ms, 17_000)
        self.assertEqual(self.song.s_lyrics_offset_ref, "0123456789abcdef")

    def test_rejects_offsets_beyond_five_minutes(self):
        response = self.client.patch(
            f"/api/songs/update/{self.song.id}",
            {"s_lyrics_offset_ms": -300_001},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_requires_login_to_change_offset(self):
        response = APIClient().patch(
            f"/api/songs/update/{self.song.id}",
            {"s_lyrics_offset_ms": 1_000},
            format="json",
        )

        self.assertIn(response.status_code, (401, 403))
        self.song.refresh_from_db()
        self.assertEqual(self.song.s_lyrics_offset_ms, 0)

    def test_changing_the_video_resets_the_offset(self):
        self.song.s_lyrics_offset_ms = 17_000
        self.song.s_lyrics_offset_ref = "0123456789abcdef"
        self.song.save()

        response = self.client.patch(
            f"/api/songs/update/{self.song.id}",
            {"s_yt_id": "lmnopqrstuv", "s_lyrics_offset_ms": 17_000, "s_lyrics_offset_ref": "0123456789abcdef"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.song.refresh_from_db()
        self.assertEqual(self.song.s_lyrics_offset_ms, 0)
        self.assertEqual(self.song.s_lyrics_offset_ref, "")

    def test_editing_other_fields_keeps_the_offset(self):
        self.song.s_lyrics_offset_ms = 17_000
        self.song.save()

        self.client.patch(
            f"/api/songs/update/{self.song.id}",
            {"s_yt_id": "abcdefghijk", "s_comment": "great"},
            format="json",
        )

        self.song.refresh_from_db()
        self.assertEqual(self.song.s_lyrics_offset_ms, 17_000)


class LyricsFingerprintTests(TestCase):
    @staticmethod
    def synced(*lines: tuple[int, str]) -> LyricsResult:
        return LyricsResult(
            provider="test",
            synced=True,
            lines=[LyricLine(start_ms=start_ms, text=text) for start_ms, text in lines],
        )

    def test_same_lines_share_a_fingerprint_across_providers(self):
        first = result_to_payload(self.synced((1_000, "Hello"), (2_000, "World")))
        second = result_to_payload(
            LyricsResult(
                provider="other",
                synced=True,
                lines=[LyricLine(start_ms=1_000, text="Hello"), LyricLine(start_ms=2_000, text="World")],
            )
        )

        self.assertEqual(len(first["fingerprint"]), 16)
        self.assertEqual(first["fingerprint"], second["fingerprint"])

    def test_different_timing_changes_the_fingerprint(self):
        first = result_to_payload(self.synced((1_000, "Hello")))
        shifted = result_to_payload(self.synced((1_500, "Hello")))

        self.assertNotEqual(first["fingerprint"], shifted["fingerprint"])

    def test_unsynced_and_missing_lyrics_have_no_fingerprint(self):
        self.assertIsNone(result_to_payload(LyricsResult(provider="test", plain="Hello"))["fingerprint"])
        self.assertIsNone(result_to_payload(None)["fingerprint"])
