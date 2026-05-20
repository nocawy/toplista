from unittest.mock import patch

from django.test import TestCase

from .models import Ranking
from .serializers import RankingSerializer
from .youtube_metadata import YouTubeMetadataError, clean_video_title, parse_song_title


class RankingSerializerTests(TestCase):
    def test_create_generates_slug_from_name(self):
        serializer = RankingSerializer(data={"name": "Concert Ranking"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.name, "Concert Ranking")
        self.assertEqual(ranking.slug, "concert-ranking")

    def test_create_generates_unique_slug_on_collision(self):
        Ranking.objects.create(name="Concert Ranking", slug="concert-ranking")
        serializer = RankingSerializer(data={"name": "Concert Ranking"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.slug, "concert-ranking-2")

    def test_create_preserves_explicit_slug(self):
        serializer = RankingSerializer(data={"name": "Concert Ranking", "slug": "live"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.slug, "live")


class YouTubeMetadataParserTests(TestCase):
    def test_clean_video_title_removes_common_suffixes(self):
        self.assertEqual(clean_video_title("Artist - Song (Official Video)"), "Artist - Song")
        self.assertEqual(clean_video_title("Artist - Song [Lyrics] HD"), "Artist - Song")

    def test_parse_song_title_splits_artist_and_title(self):
        parsed = parse_song_title("Artist - Song Title (Official Audio)")

        self.assertEqual(parsed.artist, "Artist")
        self.assertEqual(parsed.title, "Song Title")

    def test_parse_song_title_keeps_unsplit_title(self):
        parsed = parse_song_title("Song Title")

        self.assertEqual(parsed.artist, "")
        self.assertEqual(parsed.title, "Song Title")


class YouTubeMetadataLookupTests(TestCase):
    def test_youtube_metadata_lookup_requires_valid_id(self):
        response = self.client.get("/api/songs/youtube-metadata/?yt_id=bad")

        self.assertEqual(response.status_code, 400)

    @patch("api.views.get_youtube_song_suggestion")
    def test_youtube_metadata_lookup_returns_suggestion(self, mock_get_suggestion):
        mock_get_suggestion.return_value = {
            "s_yt_id": "abcdefghijk",
            "s_artist": "Artist",
            "s_title": "Song",
            "s_album": None,
            "s_released": None,
            "s_discovered": "2026",
            "source_title": "Artist - Song",
            "source_channel": "Artist",
            "thumbnail_url": "https://example.com/thumb.jpg",
        }

        response = self.client.get("/api/songs/youtube-metadata/?yt_id=abcdefghijk")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["s_artist"], "Artist")
        self.assertEqual(response.json()["s_title"], "Song")
        mock_get_suggestion.assert_called_once_with("abcdefghijk")

    @patch("api.views.get_youtube_song_suggestion")
    def test_youtube_metadata_lookup_handles_metadata_errors(self, mock_get_suggestion):
        mock_get_suggestion.side_effect = YouTubeMetadataError("Could not fetch YouTube metadata")

        response = self.client.get("/api/songs/youtube-metadata/?yt_id=abcdefghijk")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "Could not fetch YouTube metadata")
