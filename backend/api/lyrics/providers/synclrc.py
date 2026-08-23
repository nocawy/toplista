from __future__ import annotations

from urllib.parse import urlencode

from ..http import get_json
from ..lrc import parse_lrc, plain_from_lines
from ..types import LyricsQuery, LyricsResult
from .base import LyricProvider

BASE_URL = "https://api.synclrc.dev/lyrics"


class SyncLrcProvider(LyricProvider):
    name = "synclrc"

    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        if not query.title or not query.artist:
            return None

        params = {
            "track": query.title,
            "artist": query.artist,
        }
        if query.album:
            params["album"] = query.album
        if query.duration:
            params["duration"] = str(int(round(query.duration)))

        payload = get_json(f"{BASE_URL}?{urlencode(params)}")
        if not isinstance(payload, dict):
            return None
        if payload.get("instrumental"):
            return LyricsResult(provider=self.name, instrumental=True)

        synced = parse_lrc(payload.get("synced"))
        plain = (payload.get("plain") or "").strip() or None
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
