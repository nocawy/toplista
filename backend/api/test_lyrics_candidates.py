from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .lyrics.candidates import gather_candidates, rank_candidates
from .lyrics.http import ProviderUnavailable
from .lyrics.providers.base import LyricProvider
from .lyrics.providers.lrclib import LrclibProvider
from .lyrics.types import LyricLine, LyricsCandidate, LyricsQuery, LyricsResult
from .models import Song

QUERY = LyricsQuery(title="Losing My Religion", artist="R.E.M.", album="Out of Time", duration=294)
ALBUM_LRC = "[00:14.53]Oh, life, it's bigger\n[04:07.02]That was just a dream"
VIDEO_LRC = "[00:32.46]Oh, life is bigger\n[04:30.00]That was just a dream"


def record(record_id, duration, lrc=ALBUM_LRC, album="Out of Time", **extra):
    return {
        "id": record_id,
        "artistName": "R.E.M.",
        "trackName": "Losing My Religion",
        "albumName": album,
        "duration": duration,
        "syncedLyrics": lrc,
        **extra,
    }


def synced(*lines, provider="lrclib"):
    return LyricsResult(provider=provider, synced=True, lines=[LyricLine(ms, text) for ms, text in lines])


class LrclibCandidateTests(TestCase):
    @patch("api.lyrics.providers.lrclib.get_json")
    def test_collects_exact_matches_with_and_without_album_and_all_search_results(self, mock_get_json):
        def answer(url):
            if "/get?" in url and "album_name" in url:
                return record(9273844, 294, VIDEO_LRC)
            if "/get?" in url:
                return record(1, 268)
            return [record(2, 269), record(3, 267, album="Live in Athens")]

        mock_get_json.side_effect = answer

        candidates = LrclibProvider().candidates(QUERY)

        self.assertEqual([c.source_id for c in candidates], ["9273844", "1", "2", "3"])
        self.assertEqual([c.exact_match for c in candidates], [True, True, False, False])
        self.assertEqual(candidates[0].duration, 294.0)
        self.assertEqual(candidates[0].label, "R.E.M. - Losing My Religion (Out of Time)")
        self.assertFalse(any(c.result.degraded for c in candidates))

    @patch("api.lyrics.providers.lrclib.get_json")
    def test_busy_exact_lookups_mark_search_results_as_incomplete(self, mock_get_json):
        def answer(url):
            if "/search?" in url:
                return [record(2, 269)]
            raise ProviderUnavailable("HTTP 503")

        mock_get_json.side_effect = answer

        candidates = LrclibProvider().candidates(QUERY)

        self.assertEqual(len(candidates), 1)
        self.assertTrue(candidates[0].result.degraded)


class RankCandidatesTests(TestCase):
    def test_identical_files_from_many_records_become_one_candidate(self):
        ranked = rank_candidates(
            [
                LyricsCandidate(result=synced((14_530, "Oh, life")), source_id="1", duration=268),
                LyricsCandidate(result=synced((14_530, "Oh, life")), source_id="2", duration=294),
                LyricsCandidate(result=synced((14_530, "Oh, life"), provider="synclrc")),
            ],
            QUERY,
        )

        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0]["records"], 3)
        self.assertEqual(ranked[0]["durations"], [268, 294])
        self.assertEqual(ranked[0]["providers"], ["lrclib", "synclrc"])

    def test_prefers_synced_lyrics_that_fit_the_video(self):
        plain = LyricsCandidate(result=LyricsResult(provider="lrclib", plain="Oh, life"))
        too_long = LyricsCandidate(result=synced((14_000, "Oh"), (300_000, "Too late")), duration=294)
        fits = LyricsCandidate(result=synced((32_460, "Oh"), (270_000, "End")), duration=320)

        ranked = rank_candidates([plain, too_long, fits], QUERY)

        self.assertEqual([c["lines"][-1]["text"] if c["lines"] else None for c in ranked], ["End", "Too late", None])
        self.assertTrue(ranked[1]["ends_after_video"])

    def test_other_versions_rank_below_the_song_itself(self):
        live = LyricsCandidate(result=synced((1_000, "Live")), label="R.E.M. - Losing My Religion (Live in Athens)", duration=294)
        studio = LyricsCandidate(result=synced((2_000, "Studio")), label="R.E.M. - Losing My Religion", duration=280)

        ranked = rank_candidates([live, studio], QUERY)

        self.assertEqual([c["lines"][0]["text"] for c in ranked], ["Studio", "Live"])
        self.assertTrue(ranked[1]["version_mismatch"])

    def test_live_recordings_are_fine_when_the_song_is_live(self):
        live = LyricsCandidate(result=synced((1_000, "Live")), label="Band - Song (Live)", duration=294)

        ranked = rank_candidates([live], LyricsQuery(title="Song (Live)", artist="Band", duration=294))

        self.assertFalse(ranked[0]["version_mismatch"])

    def test_exact_match_then_closest_duration_then_provider(self):
        exact = LyricsCandidate(result=synced((3_000, "Exact")), duration=296, exact_match=True)
        closest = LyricsCandidate(result=synced((2_000, "Closest")), duration=294)
        synclrc = LyricsCandidate(result=synced((1_000, "SyncLRC"), provider="synclrc"))

        ranked = rank_candidates([synclrc, closest, exact], QUERY)

        self.assertEqual([c["lines"][0]["text"] for c in ranked], ["Exact", "Closest", "SyncLRC"])


class FixedProvider(LyricProvider):
    def __init__(self, name, candidates=None, error=None):
        self.name = name
        self._candidates = candidates or []
        self._error = error

    def fetch(self, query):
        return None

    def candidates(self, query):
        if self._error:
            raise self._error
        return self._candidates


class GatherCandidatesTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_reports_incomplete_when_a_source_is_unavailable(self):
        payload = gather_candidates(
            QUERY,
            providers=[
                FixedProvider("busy", error=ProviderUnavailable("HTTP 503")),
                FixedProvider("synclrc", [LyricsCandidate(result=synced((1_000, "Hi"), provider="synclrc"))]),
            ],
        )

        self.assertTrue(payload["incomplete"])
        self.assertEqual(len(payload["candidates"]), 1)

    def test_complete_answers_are_cached(self):
        provider = FixedProvider("lrclib", [LyricsCandidate(result=synced((1_000, "Hi")))])
        first = gather_candidates(QUERY, providers=[provider])
        provider._candidates = []

        second = gather_candidates(QUERY, providers=[provider])

        self.assertFalse(first["incomplete"])
        self.assertEqual(second, first)


class CandidatesEndpointTests(TestCase):
    def setUp(self):
        self.song = Song.objects.create(s_yt_id="xwtdhWltSIg", s_artist="R.E.M.", s_title="Losing My Religion")
        self.url = f"/api/songs/{self.song.id}/lyrics/candidates/?duration=294"

    def test_requires_login(self):
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    @patch("api.lyrics.views.gather_candidates", return_value={"candidates": [], "incomplete": False})
    def test_gathers_candidates_for_the_song(self, mock_gather):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor"))

        response = client.get(self.url)

        self.assertEqual(response.status_code, 200)
        query = mock_gather.call_args[0][0]
        self.assertEqual((query.title, query.artist, query.duration, query.yt_id), ("Losing My Religion", "R.E.M.", 294.0, "xwtdhWltSIg"))
