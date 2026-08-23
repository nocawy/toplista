from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import LyricsQuery, LyricsResult


class LyricProvider(ABC):
    """One lyrics source. Return None when this source has nothing useful."""

    name: str

    @abstractmethod
    def fetch(self, query: LyricsQuery) -> LyricsResult | None:
        raise NotImplementedError
