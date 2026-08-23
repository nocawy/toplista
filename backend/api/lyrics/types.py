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
