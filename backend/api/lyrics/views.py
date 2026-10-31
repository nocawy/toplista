from __future__ import annotations

import math

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import SimpleRateThrottle

from ..models import Song, SongLyrics
from ..youtube_metadata import is_valid_youtube_id
from .candidates import gather_candidates
from .service import fetch_lyrics
from .stored import StoredLyricsSerializer, stored_to_payload
from .types import LyricsQuery


class LyricsRateThrottle(SimpleRateThrottle):
    rate = getattr(settings, "LYRICS_RATE_LIMIT", "30/min")

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": "lyrics",
            "ident": self.get_ident(request),
        }


class LyricsReadRateThrottle(LyricsRateThrottle):
    """Throttle lookups only; saving chosen lyrics never reaches a provider."""

    def allow_request(self, request, view):
        if request.method != "GET":
            return True
        return super().allow_request(request, view)


class InvalidDuration(ValueError):
    pass


def _parse_duration(raw) -> float | None:
    if raw in (None, ""):
        return None
    try:
        duration = float(raw)
    except (TypeError, ValueError) as exc:
        raise InvalidDuration("duration must be a number") from exc
    if not math.isfinite(duration) or duration <= 0 or duration > 3600:
        raise InvalidDuration("duration must be between 0 and 3600 seconds")
    return duration


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

    try:
        duration = _parse_duration(request.GET.get("duration"))
    except InvalidDuration as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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


def song_lyrics_query(song: Song, duration: float | None) -> LyricsQuery:
    return LyricsQuery(
        title=song.s_title,
        artist=song.s_artist or "",
        album=song.s_album or None,
        duration=duration,
        yt_id=song.s_yt_id,
    )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticatedOrReadOnly])
@throttle_classes([LyricsReadRateThrottle])
def song_lyrics(request, pk):
    """Stored lyrics for a song, or a live lookup when none were chosen yet."""
    song = get_object_or_404(Song, pk=pk)

    if request.method == "PUT":
        stored = SongLyrics.objects.filter(song=song).first()
        serializer = StoredLyricsSerializer(stored, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(stored_to_payload(serializer.save(song=song)))

    if request.method == "DELETE":
        SongLyrics.objects.filter(song=song).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    stored = SongLyrics.objects.filter(song=song).first()
    if stored is not None:
        return Response(stored_to_payload(stored))

    try:
        duration = _parse_duration(request.GET.get("duration"))
    except InvalidDuration as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({**fetch_lyrics(song_lyrics_query(song, duration)), "stored": None})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([LyricsRateThrottle])
def song_lyrics_candidates(request, pk):
    """Every distinct lyrics file the providers offer for a song, best guess first."""
    song = get_object_or_404(Song, pk=pk)
    try:
        duration = _parse_duration(request.GET.get("duration"))
    except InvalidDuration as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(gather_candidates(song_lyrics_query(song, duration)))
