from __future__ import annotations

from urllib.parse import urlencode

from ..http import get_json
from ..lrc import parse_lrc, plain_from_lines
from ..types import LyricsQuery, LyricsResult
from .base import LyricProvider

BASE_URL = "https://lrclib.net/api"


class LrclibProvider(LyricProvider):
    name = "lrclib"

    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        if not query.title:
            return None

        record = None
        if query.artist:
            record = self._get(query)
        if record is None:
            record = self._search(query)
        if not isinstance(record, dict):
            return None
        return self._to_result(record)

    def _get(self, query: LyricsQuery) -> dict | None:
        params = {
            "track_name": query.title,
            "artist_name": query.artist,
        }
        if query.album:
            params["album_name"] = query.album
        if query.duration:
            params["duration"] = str(int(round(query.duration)))

        payload = get_json(f"{BASE_URL}/get?{urlencode(params)}")
        return payload if isinstance(payload, dict) else None

    def _search(self, query: LyricsQuery) -> dict | None:
        params: dict[str, str] = {"track_name": query.title}
        if query.artist:
            params["artist_name"] = query.artist
        payload = get_json(f"{BASE_URL}/search?{urlencode(params)}")
        if not isinstance(payload, list) or not payload:
            return None
        return _pick_search_result(payload, query.duration)

    def _to_result(self, record: dict) -> LyricsResult | None:
        if record.get("instrumental"):
            return LyricsResult(provider=self.name, instrumental=True)

        synced = parse_lrc(record.get("syncedLyrics"))
        plain = (record.get("plainLyrics") or "").strip() or None
        if synced:
            return LyricsResult(
                provider=self.name,
                synced=True,
                lines=synced,
                plain=plain or plain_from_lines(synced),
            )
        if plain:
            return LyricsResult(provider=self.name, plain=plain)
        return None


def _pick_search_result(results: list, duration: float | None) -> dict | None:
    usable = [
        item
        for item in results
        if isinstance(item, dict)
        and (item.get("syncedLyrics") or item.get("plainLyrics") or item.get("instrumental"))
    ]
    if not usable:
        return None

    def duration_delta(item: dict) -> float:
        item_duration = item.get("duration")
        if duration is None:
            return 0.0
        if not isinstance(item_duration, (int, float)):
            return float("inf")
        return abs(float(item_duration) - duration)

    def rank(item: dict) -> tuple[float, int]:
        synced_penalty = 0 if item.get("syncedLyrics") else 1
        if duration is None:
            return (float(synced_penalty), 0)
        return (duration_delta(item), synced_penalty)

    return min(usable, key=rank)
