from django.db import models


class Song(models.Model):
    s_yt_id = models.CharField(max_length=11, unique=True)  # Youtube ID
    s_artist = models.CharField(max_length=99, blank=True, null=True)
    s_title = models.CharField(max_length=99)
    s_album = models.CharField(max_length=99, blank=True, null=True)
    s_released = models.IntegerField(blank=True, null=True)
    s_discovered = models.CharField(max_length=20, blank=True, null=True)
    s_comment = models.TextField(blank=True, null=True)
    # Global timestamps for the song entity
    s_last_updated = models.DateTimeField(auto_now=True)
    s_created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.s_yt_id} - {self.s_title}"


class SongLyrics(models.Model):
    """Lyrics chosen for a song; served instead of looking them up again."""

    MANUAL = "manual"
    VERIFIED = "verified"
    STATUS_CHOICES = [
        (MANUAL, "Chosen in the player"),
        (VERIFIED, "Picked by checking the audio"),
    ]

    song = models.OneToOneField(
        Song, on_delete=models.CASCADE, primary_key=True, related_name="stored_lyrics"
    )
    provider = models.CharField(max_length=40)
    source_id = models.CharField(max_length=64, blank=True, default="")
    instrumental = models.BooleanField(default=False)
    lines = models.JSONField(default=list, blank=True)
    plain = models.TextField(blank=True, null=True)
    # Positive values show the lines later than their timestamps.
    offset_ms = models.IntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=MANUAL)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.song} ({self.provider}, {self.status})"


class Ranking(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.slug})"


class RankingEntry(models.Model):
    ranking = models.ForeignKey(
        Ranking, on_delete=models.CASCADE, related_name="entries"
    )
    song = models.ForeignKey(
        Song, on_delete=models.CASCADE, related_name="memberships"
    )
    r_rank = models.IntegerField()
    r_last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ranking", "song"], name="u_ranking_song"
            ),
            models.UniqueConstraint(
                fields=["ranking", "r_rank"], name="u_ranking_rank"
            ),
            models.CheckConstraint(
                check=models.Q(r_rank__gte=1), name="ck_rank_positive"
            ),
        ]
        ordering = ["r_rank"]

    def __str__(self):
        return f"{self.r_rank} - {self.song.s_yt_id} - {self.song.s_title} @ {self.ranking.slug}"
