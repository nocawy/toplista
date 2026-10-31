from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .lyrics.service import lyrics_fingerprint
from .lyrics.types import LyricLine
from .models import Song, SongLyrics

LIVE_PAYLOAD = {
    "found": True,
    "provider": "lrclib",
    "instrumental": False,
    "synced": True,
    "lines": [{"start_ms": 1000, "text": "Live line"}],
    "plain": "Live line",
    "fingerprint": "live",
}

CHOSEN = {
    "provider": "lrclib",
    "source_id": "9273844",
    "lines": [{"start_ms": 32_460, "text": "Oh, life is bigger"}, {"start_ms": 14_000, "text": "Intro"}],
    "offset_ms": 1_500,
}


class SongLyricsEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.song = Song.objects.create(
            s_yt_id="xwtdhWltSIg", s_artist="R.E.M.", s_title="Losing My Religion", s_album="Out of Time"
        )
        self.url = f"/api/songs/{self.song.id}/lyrics/"
        self.editor = APIClient()
        self.editor.force_authenticate(User.objects.create_user(username="editor"))

    @patch("api.lyrics.views.fetch_lyrics", return_value=LIVE_PAYLOAD)
    def test_looks_up_live_lyrics_from_song_fields_when_none_are_stored(self, mock_fetch):
        response = self.client.get(f"{self.url}?duration=294")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lines"][0]["text"], "Live line")
        self.assertIsNone(response.json()["stored"])
        query = mock_fetch.call_args[0][0]
        self.assertEqual(
            (query.title, query.artist, query.album, query.duration, query.yt_id),
            ("Losing My Religion", "R.E.M.", "Out of Time", 294.0, "xwtdhWltSIg"),
        )

    @patch("api.lyrics.views.fetch_lyrics")
    def test_serves_stored_lyrics_without_a_lookup(self, mock_fetch):
        SongLyrics.objects.create(
            song=self.song,
            provider="lrclib",
            lines=[{"start_ms": 32_460, "text": "Oh, life is bigger"}],
            offset_ms=-500,
            status=SongLyrics.VERIFIED,
        )

        payload = self.client.get(self.url).json()

        mock_fetch.assert_not_called()
        self.assertTrue(payload["synced"])
        self.assertEqual(payload["lines"], [{"start_ms": 32_460, "text": "Oh, life is bigger"}])
        self.assertEqual(payload["stored"]["status"], "verified")
        self.assertEqual(payload["stored"]["offset_ms"], -500)
        self.assertEqual(payload["fingerprint"], lyrics_fingerprint([LyricLine(32_460, "Oh, life is bigger")]))

    def test_saving_requires_login(self):
        self.assertIn(self.client.put(self.url, CHOSEN, content_type="application/json").status_code, (401, 403))
        self.assertIn(self.client.delete(self.url).status_code, (401, 403))
        self.assertFalse(SongLyrics.objects.exists())

    def test_stores_chosen_lyrics_in_time_order(self):
        response = self.editor.put(self.url, CHOSEN, format="json")

        self.assertEqual(response.status_code, 200)
        stored = SongLyrics.objects.get(song=self.song)
        self.assertEqual([line["start_ms"] for line in stored.lines], [14_000, 32_460])
        self.assertEqual(stored.plain, "Intro\nOh, life is bigger")
        self.assertEqual((stored.offset_ms, stored.status, stored.source_id), (1_500, "manual", "9273844"))
        self.assertEqual(response.json()["stored"]["offset_ms"], 1_500)

    def test_saving_again_replaces_everything(self):
        self.editor.put(self.url, CHOSEN, format="json")

        self.editor.put(self.url, {"provider": "synclrc", "lines": [{"start_ms": 0, "text": "Other"}]}, format="json")

        stored = SongLyrics.objects.get(song=self.song)
        self.assertEqual((stored.provider, stored.source_id, stored.offset_ms), ("synclrc", "", 0))
        self.assertEqual(stored.lines, [{"start_ms": 0, "text": "Other"}])

    def test_can_store_that_a_song_is_instrumental(self):
        response = self.editor.put(self.url, {"provider": "lrclib", "instrumental": True}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["instrumental"])

    def test_rejects_empty_lyrics_and_out_of_range_offsets(self):
        empty = self.editor.put(self.url, {"provider": "lrclib"}, format="json")
        far = self.editor.put(self.url, {**CHOSEN, "offset_ms": 300_001}, format="json")
        status = self.editor.put(self.url, {**CHOSEN, "status": "guessed"}, format="json")

        self.assertEqual((empty.status_code, far.status_code, status.status_code), (400, 400, 400))
        self.assertFalse(SongLyrics.objects.exists())

    @patch("api.lyrics.views.fetch_lyrics", return_value=LIVE_PAYLOAD)
    def test_forgetting_returns_to_live_lookups(self, _mock_fetch):
        self.editor.put(self.url, CHOSEN, format="json")

        response = self.editor.delete(self.url)

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(self.client.get(self.url).json()["stored"])

    def test_unknown_song_is_not_found(self):
        self.assertEqual(self.client.get("/api/songs/999999/lyrics/").status_code, 404)

    def test_changing_the_video_forgets_stored_lyrics(self):
        self.editor.put(self.url, CHOSEN, format="json")

        self.editor.patch(f"/api/songs/update/{self.song.id}", {"s_yt_id": "lmnopqrstuv"}, format="json")

        self.assertFalse(SongLyrics.objects.filter(song=self.song).exists())

    def test_deleting_the_song_deletes_its_lyrics(self):
        self.editor.put(self.url, CHOSEN, format="json")

        self.song.delete()

        self.assertFalse(SongLyrics.objects.exists())
