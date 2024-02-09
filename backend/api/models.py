from django.db import models

class Song(models.Model):
    s_yt_id = models.CharField(max_length=11, unique=True)  # Youtube ID
    s_artist = models.CharField(max_length=99, blank=True, null=True)
    s_title = models.CharField(max_length=99)
    s_album = models.CharField(max_length=99, blank=True, null=True)
    s_released = models.IntegerField(blank=True, null=True)
    s_discovered = models.CharField(max_length=20, blank=True, null=True)
    s_comment = models.TextField(blank=True, null=True)
    s_last_updated = models.DateTimeField(auto_now=True)
    s_created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.s_yt_id} - {self.s_title}"


class Rank(models.Model):
    song = models.OneToOneField(Song, on_delete=models.CASCADE, related_name='rank')
    r_rank = models.IntegerField()
    r_last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.r_rank} - {self.song.s_yt_id} - {self.song.s_title}"
