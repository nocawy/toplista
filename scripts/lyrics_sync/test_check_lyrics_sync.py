import json
import unittest
from unittest.mock import MagicMock, patch

from check_lyrics_sync import (
    USER_AGENT,
    ToplistaApi,
    align,
    choose_candidate,
    guess_language,
    normalize,
    verdict,
)

VERSE = [
    "oh life is bigger",
    "it's bigger than you",
    "and you are not me",
    "the lengths that I will go to",
    "the distance in your eyes",
    "oh no I've said too much",
    "I set it up right here",
]


def lrc(lines, start_s=10.0, gap_s=4.0):
    return [{"start_ms": int((start_s + index * gap_s) * 1000), "text": text} for index, text in enumerate(lines)]


def transcript(lines, start_s, gap_s=4.0, drift_per_line_s=0.0):
    words = []
    for index, line in enumerate(lines):
        line_start = start_s + index * (gap_s + drift_per_line_s)
        for word_index, word in enumerate(line.split()):
            words.append({"word": f" {word}", "start": line_start + word_index * 0.3})
    return words


class AlignTests(unittest.TestCase):
    def test_finds_a_late_start_in_the_video(self):
        result = align(lrc(VERSE), transcript(VERSE, start_s=27.0))

        self.assertAlmostEqual(result.offset_s, 17.0, places=1)
        self.assertEqual(result.matched, len(VERSE))
        self.assertEqual(verdict(result, min_offset_s=1.0), "out of sync")

    def test_matching_timing_is_in_sync(self):
        result = align(lrc(VERSE), transcript(VERSE, start_s=10.2))

        self.assertEqual(verdict(result, min_offset_s=1.0), "in sync")

    def test_tolerates_transcription_mistakes(self):
        heard = [line.replace("lengths", "links").replace("distance", "distant") for line in VERSE]

        result = align(lrc(VERSE), transcript(heard, start_s=8.0))

        self.assertAlmostEqual(result.offset_s, -2.0, places=1)

    def test_repeated_chorus_does_not_pull_the_offset(self):
        chorus = ["losing my religion now", "trying to keep up with you"]
        song = VERSE + chorus + VERSE + chorus
        sung = transcript(song, start_s=25.0)

        result = align(lrc(song), sung)

        self.assertAlmostEqual(result.offset_s, 15.0, places=1)

    def test_tempo_mismatch_is_reported_as_drifting(self):
        long_song = VERSE * 3

        result = align(lrc(long_song), transcript(long_song, start_s=10.0, drift_per_line_s=0.25))

        self.assertEqual(verdict(result, min_offset_s=1.0), "drifting")

    def test_unrelated_audio_is_inconclusive(self):
        other = ["completely different words here", "nothing like the lyrics at all"]

        result = align(lrc(VERSE), transcript(other, start_s=10.0))

        self.assertEqual(verdict(result, min_offset_s=1.0), "inconclusive")


class ChooseCandidateTests(unittest.TestCase):
    def candidate(self, start_s, lines=VERSE):
        return {"synced": True, "lines": lrc(lines, start_s=start_s)}

    def test_prefers_the_file_timed_for_this_recording(self):
        sung = transcript(VERSE, start_s=27.0)
        album_timed = self.candidate(10.0)
        video_timed = self.candidate(27.3)

        index, alignment = choose_candidate([album_timed, video_timed], sung)

        self.assertEqual(index, 1)
        self.assertAlmostEqual(alignment.offset_s, -0.3, places=1)

    def test_a_shifted_file_still_wins_over_wrong_lyrics(self):
        sung = transcript(VERSE, start_s=27.0)
        other_song = self.candidate(27.0, ["completely different words here", "nothing like the lyrics at all"] * 3)

        index, alignment = choose_candidate([other_song, self.candidate(10.0)], sung)

        self.assertEqual(index, 1)
        self.assertAlmostEqual(alignment.offset_s, 17.0, places=1)

    def test_nothing_fits_when_no_candidate_matches(self):
        sung = transcript(["completely different words here", "nothing like the lyrics at all"], start_s=5.0)

        self.assertIsNone(choose_candidate([self.candidate(10.0), {"synced": False, "lines": []}], sung))


class ToplistaApiTests(unittest.TestCase):
    @patch("check_lyrics_sync.urllib.request.urlopen")
    def test_identifies_itself_to_the_server(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = b"[]"
        mock_urlopen.return_value.__enter__.return_value = response

        ToplistaApi("https://example.com/toplista/backend/api").songs("main")

        request = mock_urlopen.call_args[0][0]
        self.assertEqual(request.full_url, "https://example.com/toplista/backend/api/songs/?list=main")
        self.assertEqual(request.get_header("User-agent"), USER_AGENT)

    @patch("check_lyrics_sync.urllib.request.urlopen")
    def test_saves_the_pick_as_verified_lyrics(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = b"{}"
        mock_urlopen.return_value.__enter__.return_value = response
        api = ToplistaApi("https://example.com/api/")
        api.access = "token"

        api.store_lyrics(7, {"provider": "lrclib", "source_id": "42", "lines": lrc(VERSE[:1]), "plain": "x"}, 17_000)

        request = mock_urlopen.call_args[0][0]
        self.assertEqual((request.get_method(), request.full_url), ("PUT", "https://example.com/api/songs/7/lyrics/"))
        self.assertEqual(request.get_header("Authorization"), "Bearer token")
        body = json.loads(request.data)
        self.assertEqual((body["status"], body["offset_ms"], body["source_id"]), ("verified", 17_000, "42"))


class TextTests(unittest.TestCase):
    def test_normalize_strips_accents_and_punctuation(self):
        self.assertEqual(normalize("Się ściemnia, łąka!"), "sie sciemnia laka")
        self.assertEqual(normalize("It's bigger"), "its bigger")

    def test_guess_language_from_lyrics(self):
        self.assertEqual(guess_language([{"text": "Oh life, it's bigger than you and me"}]), "en")
        self.assertEqual(guess_language([{"text": "Się ściemnia, już północ, żółć"}]), "pl")
        self.assertEqual(guess_language([{"text": "Просвистела"}]), "ru")
        self.assertIsNone(guess_language([{"text": "la la la"}]))


if __name__ == "__main__":
    unittest.main()
