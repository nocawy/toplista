from __future__ import annotations

import math

from django.conf import settings
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import SimpleRateThrottle

from ..youtube_metadata import is_valid_youtube_id
from .service import fetch_lyrics
from .types import LyricsQuery


class LyricsRateThrottle(SimpleRateThrottle):
    rate = getattr(settings, "LYRICS_RATE_LIMIT", "30/min")

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": "lyrics",
            "ident": self.get_ident(request),
        }


@api_view(["GET"])
@throttle_classes([LyricsRateThrottle])
def lyrics_lookup(request):
    title = (request.GET.get("title") or "").strip()
    if not title:
        return Response({"detail": "title is required"}, status=status.HTTP_400_BAD_REQUEST)
    if len(title) > 300:
        return Response({"detail": "title is too long"}, status=status.HTTP_400_BAD_REQUEST)

    artist = (request.GET.get("artist") or "").strip()
    album = (request.GET.get("album") or "").strip()
    if len(artist) > 300 or len(album) > 300:
        return Response({"detail": "artist or album is too long"}, status=status.HTTP_400_BAD_REQUEST)

    duration = None
    duration_raw = request.GET.get("duration")
    if duration_raw not in (None, ""):
        try:
            duration = float(duration_raw)
        except (TypeError, ValueError):
            return Response({"detail": "duration must be a number"}, status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(duration) or duration <= 0 or duration > 3600:
            return Response(
                {"detail": "duration must be between 0 and 3600 seconds"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    yt_id = (request.GET.get("yt_id") or "").strip()
    if yt_id and not is_valid_youtube_id(yt_id):
        return Response(
            {"detail": "yt_id must be an 11-character YouTube ID"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    query = LyricsQuery(
        title=title,
        artist=artist,
        album=album or None,
        duration=duration,
        yt_id=yt_id or None,
    )
    return Response(fetch_lyrics(query))
