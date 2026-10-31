"""Group the lyrics files providers offer for a song and rank them cheaply.

Ranking without listening to the audio can only use metadata, so the order is
a best guess: synced lyrics first, then files that fit inside the video, match
its version (no "live" or "remix" unless the song says so), came from an exact
LRCLIB match, describe a recording of a similar length, and are shared by more
records.
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field

from django.conf import settings
from django.core.cache import cache

from .http import ProviderUnavailable
from .providers import LyricProvider
from .service import cache_key, default_providers, lyrics_fingerprint, result_to_payload
from .types import LyricsCandidate, LyricsQuery, LyricsResult

logger = logging.getLogger(__name__)

CACHE_PREFIX = "lyrics-candidates:v1:"

VERSION_MARKERS = re.compile(
    r"\b(live|remix|acoustic|demo|karaoke|instrumental|cover|unplugged|radio edit|extended|sessions?)\b"
)
PROVIDER_PREFERENCE = {"lrclib": 0, "simpmusic": 1, "synclrc": 2}


def gather_candidates(query: LyricsQuery, providers: list[LyricProvider] | None = None) -> dict:
    """Ranked, deduplicated candidates; "incomplete" when a source could not answer."""
    key = cache_key(query, prefix=CACHE_PREFIX)
    cached = cache.get(key)
    if isinstance(cached, dict):
        return cached

    found: list[LyricsCandidate] = []
    incomplete = False
    for provider in providers if providers is not None else default_providers():
        try:
            found.extend(provider.candidates(query))
        except ProviderUnavailable as exc:
            logger.info("lyrics provider %s unavailable: %s", provider.name, exc)
            incomplete = True
        except Exception:
            logger.exception("lyrics provider %s failed", provider.name)
            incomplete = True
    incomplete = incomplete or any(candidate.result.degraded for candidate in found)

    payload = {"candidates": rank_candidates(found, query), "incomplete": incomplete}
    ttl = (
        int(getattr(settings, "LYRICS_CACHE_DEGRADED_TTL", 60 * 2))
        if incomplete
        else int(getattr(settings, "LYRICS_CANDIDATES_CACHE_TTL", 60 * 60))
    )
    cache.set(key, payload, ttl)
    return payload


def candidate_id(result: LyricsResult) -> str:
    if result.instrumental:
        return "instrumental"
    if result.synced:
        return lyrics_fingerprint(result.lines) or "synced"
    plain = " ".join((result.plain or "").split()).casefold()
    return "plain-" + hashlib.sha1(plain.encode("utf-8")).hexdigest()[:16]


@dataclass
class CandidateGroup:
    candidate: LyricsCandidate
    providers: list[str] = field(default_factory=list)
    durations: list[float] = field(default_factory=list)
    records: int = 0
    exact_match: bool = False

    def add(self, candidate: LyricsCandidate) -> None:
        if candidate.exact_match and not self.candidate.exact_match:
            self.candidate = candidate
        if candidate.result.provider not in self.providers:
            self.providers.append(candidate.result.provider)
        if candidate.duration is not None:
            self.durations.append(candidate.duration)
        self.records += 1
        self.exact_match = self.exact_match or candidate.exact_match


def _ends_after_video(result: LyricsResult, video_duration: float | None) -> bool:
    return bool(result.synced and result.lines and video_duration and result.lines[-1].start_ms > (video_duration + 1) * 1000)


def _version_mismatch(group: CandidateGroup, query: LyricsQuery) -> bool:
    song_text = f"{query.artist} {query.title} {query.album or ''}".casefold()
    labels = f"{group.candidate.label} ".casefold()
    return any(marker not in song_text for marker in VERSION_MARKERS.findall(labels))


def rank_candidates(candidates: list[LyricsCandidate], query: LyricsQuery) -> list[dict]:
    groups: dict[str, CandidateGroup] = {}
    for candidate in candidates:
        key = candidate_id(candidate.result)
        groups.setdefault(key, CandidateGroup(candidate=candidate)).add(candidate)

    def sort_key(item: tuple[str, CandidateGroup]):
        _, group = item
        result = group.candidate.result
        kind = 0 if result.synced else 1 if result.plain else 2
        duration_delta = (
            min(abs(duration - query.duration) for duration in group.durations)
            if group.durations and query.duration
            else float("inf")
        )
        return (
            kind,
            _ends_after_video(result, query.duration),
            _version_mismatch(group, query),
            not group.exact_match,
            duration_delta,
            min(PROVIDER_PREFERENCE.get(provider, 9) for provider in group.providers),
            -group.records,
        )

    ranked = []
    for key, group in sorted(groups.items(), key=sort_key):
        result = group.candidate.result
        ranked.append(
            {
                **result_to_payload(result),
                "id": key,
                "source_id": group.candidate.source_id,
                "label": group.candidate.label,
                "providers": group.providers,
                "durations": sorted(set(group.durations)),
                "records": group.records,
                "exact_match": group.exact_match,
                "ends_after_video": _ends_after_video(result, query.duration),
                "version_mismatch": _version_mismatch(group, query),
            }
        )
    return ranked
