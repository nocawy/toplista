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
