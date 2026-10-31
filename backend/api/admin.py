from django.contrib import admin
from .models import Song, SongLyrics, Ranking, RankingEntry


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("s_yt_id", "s_title", "s_artist", "s_released", "s_created_on", "s_last_updated")
    search_fields = ("s_yt_id", "s_title", "s_artist")


@admin.register(SongLyrics)
class SongLyricsAdmin(admin.ModelAdmin):
    list_display = ("song", "provider", "status", "offset_ms", "updated_on")
    list_filter = ("status", "provider")
    search_fields = ("song__s_title", "song__s_artist", "song__s_yt_id")


@admin.register(Ranking)
class RankingAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_on")
    search_fields = ("name", "slug")


@admin.register(RankingEntry)
class RankingEntryAdmin(admin.ModelAdmin):
    list_display = ("ranking", "song", "r_rank", "r_last_updated")
    list_filter = ("ranking",)
