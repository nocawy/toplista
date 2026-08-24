import csv
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from .models import Ranking, RankingEntry, Song


CSV_COLUMNS = [
    "yt_id",
    "Artist",
    "Title",
    "Album",
    "released",
    "discovered",
    "comment",
    "rank",
]


class ImportSongsCommandTests(TestCase):
    def setUp(self):
        self.ranking = Ranking.objects.get(slug="main")
        old_song = Song.objects.create(s_yt_id="oldoldold01", s_title="Existing song")
        RankingEntry.objects.create(ranking=self.ranking, song=old_song, r_rank=1)
        self.paths: list[Path] = []

    def tearDown(self):
        for path in self.paths:
            path.unlink(missing_ok=True)

    def write_csv(self, rows: list[dict]) -> str:
        handle = tempfile.NamedTemporaryFile(mode="w", newline="", encoding="utf-8", suffix=".csv", delete=False)
        path = Path(handle.name)
        self.paths.append(path)
        with handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)
        return str(path)

    def test_invalid_ranks_do_not_replace_existing_ranking(self):
        path = self.write_csv(
            [
                {
                    "yt_id": "abcdefghijk",
                    "Artist": "Artist",
                    "Title": "One",
                    "Album": "",
                    "released": "",
                    "discovered": "",
                    "comment": "",
                    "rank": 1,
                },
                {
                    "yt_id": "lmnopqrstuv",
                    "Artist": "Artist",
                    "Title": "Two",
                    "Album": "",
                    "released": "",
                    "discovered": "",
                    "comment": "",
                    "rank": 1,
                },
            ]
        )

        with self.assertRaises(CommandError):
            call_command("import_songs", path, ranking="main")

        entries = list(RankingEntry.objects.filter(ranking=self.ranking))
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].song.s_title, "Existing song")

    def test_valid_csv_replaces_ranking_in_rank_order(self):
        path = self.write_csv(
            [
                {
                    "yt_id": "lmnopqrstuv",
                    "Artist": "Artist",
                    "Title": "Two",
                    "Album": "",
                    "released": "",
                    "discovered": "",
                    "comment": "",
                    "rank": 2,
                },
                {
                    "yt_id": "abcdefghijk",
                    "Artist": "Artist",
                    "Title": "One",
                    "Album": "",
                    "released": "",
                    "discovered": "",
                    "comment": "",
                    "rank": 1,
                },
            ]
        )

        call_command("import_songs", path, ranking="main")

        entries = list(RankingEntry.objects.filter(ranking=self.ranking).select_related("song"))
        self.assertEqual([entry.r_rank for entry in entries], [1, 2])
        self.assertEqual([entry.song.s_title for entry in entries], ["One", "Two"])
