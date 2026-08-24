import csv

from django.core.management.base import BaseCommand, CommandError
from django.db import DataError, IntegrityError, transaction

from api.models import Song, Ranking, RankingEntry
from api.youtube_metadata import is_valid_youtube_id


REQUIRED_COLUMNS = (
    "yt_id",
    "Artist",
    "Title",
    "Album",
    "released",
    "discovered",
    "comment",
    "rank",
)


class Command(BaseCommand):
    help = "Import songs and ranks from a CSV into a specific ranking (does not wipe global songs)."

    def print_usage(self):
        usage_text = """
        Usage: python manage.py import_songs path/to/file.csv [--ranking <slug>]

        This command imports songs and their ranks into a given ranking (default: 'main').
        The CSV must include headers: yt_id, Artist, Title, Album, released, discovered, comment, rank.

        Behavior:
          - Deletes existing entries only within the target ranking, keeping global Song data intact.
          - Creates missing songs by yt_id; does not update global metadata for existing songs.

        Example:
            python manage.py import_songs path/to/songs.csv --ranking 2025
        """
        self.stdout.write(self.style.NOTICE(usage_text))

    def add_arguments(self, parser):
        parser.add_argument("csv_file_path", type=str, nargs="?", help="The path to the CSV file")
        parser.add_argument("--ranking", type=str, default="main", help="Ranking slug to import into (default: main)")

    def handle(self, *args, **kwargs):
        csv_file_path = kwargs["csv_file_path"]
        ranking_slug = kwargs.get("ranking") or "main"

        if not csv_file_path:
            self.print_usage()
            raise CommandError("CSV file path is required.")

        rows = self._read_and_validate_rows(csv_file_path)
        ranking, _ = Ranking.objects.get_or_create(slug=ranking_slug, defaults={"name": ranking_slug})

        try:
            with transaction.atomic():
                RankingEntry.objects.filter(ranking=ranking).delete()

                for row in rows:
                    song, _ = Song.objects.get_or_create(
                        s_yt_id=row["yt_id"],
                        defaults={
                            "s_artist": row["Artist"],
                            "s_title": row["Title"],
                            "s_album": row["Album"],
                            "s_released": row["released"],
                            "s_discovered": row["discovered"],
                            "s_comment": row["comment"],
                        },
                    )
                    RankingEntry.objects.create(ranking=ranking, song=song, r_rank=row["rank"])
        except (DataError, IntegrityError) as exc:
            raise CommandError("Import failed; no ranking changes were saved.") from exc

        self.stdout.write(self.style.SUCCESS(f"Successfully imported songs into ranking {ranking_slug}"))

    def _read_and_validate_rows(self, csv_file_path: str) -> list[dict]:
        try:
            csvfile = open(csv_file_path, newline="", encoding="utf-8-sig")
        except OSError as exc:
            raise CommandError(f"Could not open CSV file: {exc}") from exc

        with csvfile:
            reader = csv.DictReader(csvfile)
            columns = reader.fieldnames or []
            missing_columns = [column for column in REQUIRED_COLUMNS if column not in columns]
            if missing_columns:
                raise CommandError(f"CSV file is missing columns: {', '.join(missing_columns)}")

            rows = [
                self._validate_row(
                    {field: (value or "").strip() for field, value in row.items() if field is not None},
                    row_number,
                )
                for row_number, row in enumerate(reader, start=2)
            ]

        if not rows:
            raise CommandError("CSV file contains no songs.")

        youtube_ids = [row["yt_id"] for row in rows]
        if len(set(youtube_ids)) != len(youtube_ids):
            raise CommandError("CSV file contains duplicate YouTube IDs.")

        ranks = sorted(row["rank"] for row in rows)
        expected_ranks = list(range(1, len(rows) + 1))
        if ranks != expected_ranks:
            raise CommandError("CSV ranks must be unique and contiguous starting at 1.")

        return sorted(rows, key=lambda row: row["rank"])

    @staticmethod
    def _validate_row(row: dict, row_number: int) -> dict:
        youtube_id = row["yt_id"]
        title = row["Title"]
        if not youtube_id or not title or not row["rank"]:
            raise CommandError(f"Invalid data in row {row_number}: yt_id, Title and rank are required.")
        if not is_valid_youtube_id(youtube_id):
            raise CommandError(f"Invalid YouTube ID in row {row_number}.")

        max_lengths = {
            "Artist": 99,
            "Title": 99,
            "Album": 99,
            "discovered": 20,
        }
        for field, max_length in max_lengths.items():
            if len(row[field]) > max_length:
                raise CommandError(f"Invalid data in row {row_number}: {field} is too long.")

        try:
            rank = int(row["rank"])
        except ValueError as exc:
            raise CommandError(f"Invalid rank in row {row_number}.") from exc
        if rank <= 0:
            raise CommandError(f"Invalid rank in row {row_number}: rank must be greater than 0.")

        try:
            released = int(row["released"]) if row["released"] else None
        except ValueError as exc:
            raise CommandError(f"Invalid released year in row {row_number}.") from exc

        return {
            **row,
            "rank": rank,
            "released": released,
        }
