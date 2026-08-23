from __future__ import annotations

from urllib.parse import quote

from ..http import get_json
from ..lrc import parse_lrc, plain_from_lines
from ..types import LyricsQuery, LyricsResult
from .base import LyricProvider

BASE_URL = "https://api-lyrics.simpmusic.org/v1"


class SimpMusicProvider(LyricProvider):
    name = "simpmusic"

    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        if not query.yt_id:
            return None

        payload = get_json(f"{BASE_URL}/{quote(query.yt_id, safe='')}")
        record = _unwrap_record(payload)
        if record is None:
            return None

        synced = parse_lrc(record.get("syncedLyrics"))
        plain = (record.get("plainLyric") or record.get("plainLyrics") or "").strip() or None
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


def _unwrap_record(payload) -> dict | None:
    if isinstance(payload, dict) and isinstance(payload.get("data"), list) and payload["data"]:
        first = payload["data"][0]
        return first if isinstance(first, dict) else None
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    if isinstance(payload, dict) and (payload.get("syncedLyrics") or payload.get("plainLyric")):
        return payload
    return None
