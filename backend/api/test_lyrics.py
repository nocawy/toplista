from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from .lyrics.lrc import parse_lrc
from .lyrics.providers.base import LyricProvider
from .lyrics.providers.lrclib import _pick_search_result
from .lyrics.service import cache_key, fetch_lyrics
from .lyrics.types import LyricLine, LyricsQuery, LyricsResult
from .lyrics.views import LyricsRateThrottle


class ParseLrcTests(TestCase):
    def test_parses_standard_timestamps(self):
        lines = parse_lrc(
            "[ar:Radiohead]\n"
            "[00:26.78]Karma police\n"
            "[00:31.00]Arrest this man\n"
            "[01:03.27]Her Hitler hairdo\n"
        )

        self.assertEqual(lines[0].text, "Karma police")
        self.assertEqual(lines[0].start_ms, 26_780)
        self.assertEqual(lines[1].start_ms, 31_000)
        self.assertEqual(lines[2].start_ms, 63_270)

    def test_applies_offset_and_strips_enhanced_tags(self):
        lines = parse_lrc(
            "[offset:500]\n"
            "[00:01.00] <00:01.00> Hello <00:01.40> world\n"
        )

        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].start_ms, 1_500)
        self.assertEqual(lines[0].text, "Hello  world")

    def test_applies_offset_declared_after_lyrics(self):
        lines = parse_lrc("[00:01.00]Hello\n[offset:500]\n")

        self.assertEqual(lines[0].start_ms, 1_500)


class LrclibResultSelectionTests(TestCase):
    def test_duration_match_beats_distant_synced_result(self):
        result = _pick_search_result(
            [
                {"duration": 300, "syncedLyrics": "[00:01.00]Synced"},
                {"duration": 200, "plainLyrics": "Exact plain lyrics"},
            ],
            duration=200,
        )

        self.assertEqual(result["plainLyrics"], "Exact plain lyrics")

    def test_prefers_synced_result_when_duration_is_unavailable(self):
        result = _pick_search_result(
            [
                {"plainLyrics": "Plain"},
                {"syncedLyrics": "[00:01.00]Synced"},
            ],
            duration=None,
        )

        self.assertIn("syncedLyrics", result)


class FakeProvider(LyricProvider):
    def __init__(self, name: str, result: LyricsResult | None):
        self.name = name
        self._result = result

    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        return self._result


class FetchLyricsServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_prefers_synced_provider_over_earlier_plain(self):
        plain = FakeProvider("plain", LyricsResult(provider="plain", plain="unsynced"))
        synced = FakeProvider(
            "synced",
            LyricsResult(
                provider="synced",
                synced=True,
                lines=[LyricLine(start_ms=1000, text="Hello")],
                plain="Hello",
            ),
        )

        payload = fetch_lyrics(LyricsQuery(title="Song", artist="Artist"), providers=[plain, synced])

        self.assertTrue(payload["found"])
        self.assertEqual(payload["provider"], "synced")
        self.assertTrue(payload["synced"])
        self.assertEqual(payload["lines"][0]["text"], "Hello")

    def test_returns_plain_when_no_synced_result(self):
        plain = FakeProvider("plain", LyricsResult(provider="plain", plain="only plain"))
        empty = FakeProvider("empty", None)

        payload = fetch_lyrics(LyricsQuery(title="Song"), providers=[plain, empty])

        self.assertTrue(payload["found"])
        self.assertEqual(payload["provider"], "plain")
        self.assertFalse(payload["synced"])
        self.assertEqual(payload["plain"], "only plain")

    def test_caches_resolved_payload(self):
        provider = FakeProvider(
            "once",
            LyricsResult(provider="once", plain="cached"),
        )

        first = fetch_lyrics(LyricsQuery(title="Cache Me"), providers=[provider])
        provider._result = None
        second = fetch_lyrics(LyricsQuery(title="Cache Me"), providers=[provider])

        self.assertEqual(first, second)
        self.assertEqual(second["plain"], "cached")

    def test_cache_key_has_unambiguous_field_boundaries(self):
        first = cache_key(LyricsQuery(artist="a|b", title="c"))
        second = cache_key(LyricsQuery(artist="a", title="b|c"))

        self.assertNotEqual(first, second)

    @patch("api.lyrics.service.default_providers")
    def test_explicit_empty_provider_list_does_not_use_defaults(self, mock_defaults):
        payload = fetch_lyrics(LyricsQuery(title="No providers"), providers=[])

        self.assertFalse(payload["found"])
        mock_defaults.assert_not_called()


class LyricsLookupViewTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_requires_title(self):
        response = self.client.get("/api/lyrics/")

        self.assertEqual(response.status_code, 400)

    @patch("api.lyrics.views.fetch_lyrics")
    def test_returns_provider_payload(self, mock_fetch):
        mock_fetch.return_value = {
            "found": True,
            "provider": "lrclib",
            "instrumental": False,
            "synced": True,
            "lines": [{"start_ms": 1000, "text": "Hello"}],
            "plain": "Hello",
        }

        response = self.client.get("/api/lyrics/?artist=Radiohead&title=Karma+Police&duration=264")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["provider"], "lrclib")
        query = mock_fetch.call_args[0][0]
        self.assertEqual(query.title, "Karma Police")
        self.assertEqual(query.artist, "Radiohead")
        self.assertEqual(query.duration, 264.0)

    def test_rejects_non_finite_duration(self):
        response = self.client.get("/api/lyrics/?title=Song&duration=NaN")

        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_youtube_id(self):
        response = self.client.get("/api/lyrics/?title=Song&yt_id=../search")

        self.assertEqual(response.status_code, 400)

    def test_throttles_repeated_requests_by_client(self):
        with patch.object(LyricsRateThrottle, "rate", "2/min"):
            self.client.get("/api/lyrics/")
            self.client.get("/api/lyrics/")
            response = self.client.get("/api/lyrics/")

        self.assertEqual(response.status_code, 429)

    @override_settings(LYRICS_PROVIDERS=["missing-provider"])
    def test_unknown_provider_names_are_skipped(self):
        cache.clear()
        response = self.client.get("/api/lyrics/?title=Whatever")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["found"])
