from __future__ import annotations

import hashlib
import json
import logging

from django.conf import settings
from django.core.cache import cache

from .providers import PROVIDER_REGISTRY, LyricProvider
from .types import LyricLine, LyricsQuery, LyricsResult

logger = logging.getLogger(__name__)

CACHE_PREFIX = "lyrics:v1:"


def result_to_payload(result: LyricsResult | None) -> dict:
    if result is None:
        return {
            "found": False,
            "provider": None,
            "instrumental": False,
            "synced": False,
            "lines": [],
            "plain": None,
        }
    return {
        "found": True,
        "provider": result.provider,
        "instrumental": result.instrumental,
        "synced": result.synced,
        "lines": [{"start_ms": line.start_ms, "text": line.text} for line in result.lines],
        "plain": result.plain,
    }


def payload_to_result(payload: dict) -> LyricsResult | None:
    if not payload.get("found"):
        return None
    lines = [
        LyricLine(start_ms=int(item["start_ms"]), text=str(item["text"]))
        for item in payload.get("lines") or []
        if isinstance(item, dict) and "start_ms" in item and "text" in item
    ]
    return LyricsResult(
        provider=str(payload.get("provider") or "unknown"),
        instrumental=bool(payload.get("instrumental")),
        synced=bool(payload.get("synced")),
        lines=lines,
        plain=payload.get("plain"),
    )


def default_providers() -> list[LyricProvider]:
    names = getattr(settings, "LYRICS_PROVIDERS", ["lrclib"])
    providers: list[LyricProvider] = []
    for name in names:
        provider_cls = PROVIDER_REGISTRY.get(name)
        if provider_cls is None:
            logger.warning("unknown lyrics provider %s", name)
            continue
        providers.append(provider_cls())
    return providers


def cache_key(query: LyricsQuery) -> str:
    duration = str(int(round(query.duration))) if query.duration else ""
    raw = json.dumps(
        [
            (query.artist or "").casefold().strip(),
            (query.title or "").casefold().strip(),
            (query.album or "").casefold().strip(),
            duration,
            (query.yt_id or "").strip(),
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return CACHE_PREFIX + hashlib.md5(raw.encode("utf-8")).hexdigest()


def fetch_lyrics(query: LyricsQuery, providers: list[LyricProvider] | None = None) -> dict:
    key = cache_key(query)
    cached = cache.get(key)
    if isinstance(cached, dict):
        return cached

    selected_providers = providers if providers is not None else default_providers()
    result = _resolve(query, selected_providers)
    payload = result_to_payload(result)
    ttl = (
        int(getattr(settings, "LYRICS_CACHE_TTL", 60 * 60 * 24))
        if result is not None
        else int(getattr(settings, "LYRICS_CACHE_MISS_TTL", 60 * 10))
    )
    cache.set(key, payload, ttl)
    return payload


def _resolve(query: LyricsQuery, providers: list[LyricProvider]) -> LyricsResult | None:
    best_plain: LyricsResult | None = None
    for provider in providers:
        try:
            result = provider.fetch(query)
        except Exception:
            logger.exception("lyrics provider %s failed", provider.name)
            continue
        if result is None:
            continue
        if result.instrumental or result.synced:
            return result
        if best_plain is None and result.plain:
            best_plain = result
    return best_plain
