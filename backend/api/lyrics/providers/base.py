from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import LyricsCandidate, LyricsQuery, LyricsResult


class LyricProvider(ABC):
    """One lyrics source. Return None when this source has nothing useful."""

    name: str

    @abstractmethod
    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        raise NotImplementedError

    def candidates(self, query: LyricsQuery) -> list[LyricsCandidate]:
        """Every lyrics file this source offers for the query (default: its best one)."""
        result = self.fetch(query)
        return [LyricsCandidate(result=result)] if result is not None else []
