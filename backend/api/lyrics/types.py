from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LyricsQuery:
    title: str
    artist: str = ""
    album: str | None = None
    duration: float | None = None
    yt_id: str | None = None


@dataclass(frozen=True)
class LyricLine:
    start_ms: int
    text: str


@dataclass(frozen=True)
class LyricsResult:
    provider: str
    instrumental: bool = False
    synced: bool = False
    lines: list[LyricLine] = field(default_factory=list)
    plain: str | None = None
    # A fallback answer; the provider may return a better match once it recovers.
    degraded: bool = False


@dataclass(frozen=True)
class LyricsCandidate:
    """One lyrics file a provider offers for a query, with what it says about it."""

    result: LyricsResult
    source_id: str = ""
    label: str = ""
    # Length of the recording the provider's record describes, if known.
    duration: float | None = None
    exact_match: bool = False
