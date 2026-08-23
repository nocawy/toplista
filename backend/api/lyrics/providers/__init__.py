from .base import LyricProvider
from .lrclib import LrclibProvider
from .simpmusic import SimpMusicProvider
from .synclrc import SyncLrcProvider

PROVIDER_REGISTRY: dict[str, type[LyricProvider]] = {
    "lrclib": LrclibProvider,
    "simpmusic": SimpMusicProvider,
    "synclrc": SyncLrcProvider,
}

__all__ = [
    "LyricProvider",
    "LrclibProvider",
    "PROVIDER_REGISTRY",
    "SimpMusicProvider",
    "SyncLrcProvider",
]
