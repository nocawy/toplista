import csv
from django.core.management.base import BaseCommand
from django.db import IntegrityError, DataError
from api.models import Song, Rank

class Command(BaseCommand):
    help = 'Import songs and their ranks from a CSV file. Note: removes all existing songs before importing.'

    def print_usage(self):
        usage_text = """
        Usage: python manage.py import_songs path/to/file.csv

        This script imports songs and their ranks from a specified CSV file into the Django database.
        The CSV file must include the following headers: yt_id, Artist, Title, Album, released, discovered, comment, rank.

        Attention: This script performs a clean import by removing all existing songs from the database before importing new data.
                
        Example:
            python manage.py import_songs path/to/songs.csv
        """
        self.stdout.write(self.style.NOTICE(usage_text))

    def add_arguments(self, parser):
        parser.add_argument('csv_file_path', type=str, nargs='?', help='The path to the CSV file')

    def handle(self, *args, **kwargs):
        csv_file_path = kwargs['csv_file_path']

        if not csv_file_path:
            self.print_usage()
            return  # Exit the command if no CSV file path is provided

        required_columns = ['yt_id', 'Artist', 'Title', 'Album', 'released', 'discovered', 'comment', 'rank']
        
        # Open the CSV file
        with open(csv_file_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            columns = reader.fieldnames

            # Check if all required columns are in the CSV file
            if not all(column in columns for column in required_columns):
                self.stdout.write(self.style.ERROR('CSV file is missing one or more required columns.'))
                return
            
            valid_rows = []
            row_number = 0

            # Process each row in the CSV file and validate the data before modifying the database
            for row in reader:
                row_number += 1

                # Strip leading and trailing whitespace from each field to ensure clean data before processing.
                for field in row:
                    row[field] = row[field].strip()
                    
                # Check if the required text fields are not empty
                for field in ['yt_id', 'Title', 'rank']:
                    if not row[field]:
                        raise ValueError(f"Invalid data in row {row_number}: {field} cannot be empty.")

                # Check if the required integer fields are NOT empty AND valid integers
                for field in ['rank']:
                    try:
                        row[field] = int(row[field])
                    except ValueError:
                        raise ValueError(f"Invalid data in row {row_number} in the column '{field}': {row[field]} is empty or not an integer.")

                # Check if the rank is greater than 0
                if row['rank'] <= 0:
                    raise ValueError(f"Invalid rank in row {row_number}: {row['rank']} must be greater than 0.")
                
                # Check if the optional integer fields are either empty or valid integers
                for field in ['released']:
                    try:
                        if row[field]:
                            row[field] = int(row[field])
                        else:
                            row[field] = None
                    except ValueError:
                        raise ValueError(f"Invalid data in row {row_number} in the column '{field}': {row[field]} is not an integer.")

                valid_rows.append(row)

            self.stdout.write(self.style.SUCCESS('Data validation passed. Proceeding with import...'))

            # WARNING: This will remove all existing Song and Rank data from the database
            Song.objects.all().delete()
            Rank.objects.all().delete()
            
            # Insert new data into database
            for row in valid_rows:
                try:
                    song = Song(
                        s_yt_id=row['yt_id'],
                        s_artist=row['Artist'],
                        s_title=row['Title'],
                        s_album=row.get('Album', ''),  # Using .get() ensures no error if the album field is empty
                        s_released=row['released'],
                        s_discovered=row.get('discovered', ''), # Same as above
                        s_comment=row.get('comment', '')  # Same as above
                    )
                    song.save()

                    rank = Rank(
                        song=song,
                        r_rank=row['rank']
                    )
                    rank.save()

                except IntegrityError as e:
                    self.stdout.write(self.style.ERROR(f'Integrity error for {row.get("yt_id")}: {e}'))
                except DataError as e:
                    self.stdout.write(self.style.ERROR(f'Data error for {row.get("yt_id")}: {e}'))
                except ValueError as e:
                    self.stdout.write(self.style.ERROR(f'Value error for {row.get("yt_id")}: {e}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Unexpected error: {e}'))

        self.stdout.write(self.style.SUCCESS('Successfully imported songs and ranks from CSV'))
