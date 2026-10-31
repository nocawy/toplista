from django.test import TestCase

from .lyrics.service import result_to_payload
from .lyrics.types import LyricLine, LyricsResult


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
