from __future__ import annotations

import re

from .types import LyricLine

TIMESTAMP_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]")
OFFSET_RE = re.compile(r"\[offset:([+-]?\d+)\]", re.IGNORECASE)
ENHANCED_WORD_RE = re.compile(r"<\d{1,2}:\d{2}(?:\.\d{1,3})?>")
METADATA_RE = re.compile(r"^\[(ar|ti|al|au|by|length|re|ve|id):", re.IGNORECASE)


def _fraction_to_ms(fraction: str | None) -> int:
    if not fraction:
        return 0
    if len(fraction) == 1:
        return int(fraction) * 100
    if len(fraction) == 2:
        return int(fraction) * 10
    return int(fraction[:3])


def parse_lrc(lrc: str | None) -> list[LyricLine]:
    """Parse LRC (and enhanced LRC) text into timestamped lines."""
    if not lrc or not lrc.strip():
        return []

    raw_lines = lrc.splitlines()
    offset_ms = 0
    for raw in raw_lines:
        offset_match = OFFSET_RE.fullmatch(raw.strip())
        if offset_match:
            offset_ms = int(offset_match.group(1))

    events: list[tuple[int, str]] = []

    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue

        if OFFSET_RE.fullmatch(line):
            continue

        timestamps = list(TIMESTAMP_RE.finditer(line))
        if not timestamps:
            continue
        if METADATA_RE.match(line) and line.endswith("]") and len(timestamps) == 1:
            continue

        text = TIMESTAMP_RE.sub("", line)
        text = ENHANCED_WORD_RE.sub("", text).strip()
        if not text:
            continue

        for match in timestamps:
            start_ms = (
                int(match.group(1)) * 60_000
                + int(match.group(2)) * 1_000
                + _fraction_to_ms(match.group(3))
                + offset_ms
            )
            events.append((max(0, start_ms), text))

    events.sort(key=lambda item: (item[0], item[1]))
    return [LyricLine(start_ms=start_ms, text=text) for start_ms, text in events]


def plain_from_lines(lines: list[LyricLine]) -> str:
    return "\n".join(line.text for line in lines)
