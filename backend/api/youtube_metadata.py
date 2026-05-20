import json
import re
from dataclasses import dataclass
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


class YouTubeMetadataError(Exception):
    """Raised when public YouTube metadata cannot be fetched."""


@dataclass(frozen=True)
class ParsedSongTitle:
    artist: str
    title: str


def is_valid_youtube_id(yt_id: str) -> bool:
    return bool(YOUTUBE_ID_RE.fullmatch(yt_id))


def clean_video_title(title: str) -> str:
    cleaned = title.strip()
    suffixes = [
        r"\s*\((official\s+)?music\s+video\)\s*$",
        r"\s*\[(official\s+)?music\s+video\]\s*$",
        r"\s*\(official\s+video\)\s*$",
        r"\s*\[official\s+video\]\s*$",
        r"\s*\(official\s+audio\)\s*$",
        r"\s*\[official\s+audio\]\s*$",
        r"\s*\(lyrics?\)\s*$",
        r"\s*\[lyrics?\]\s*$",
        r"\s*\(audio\)\s*$",
        r"\s*\[audio\]\s*$",
        r"\s*\bHD\b\s*$",
    ]

    changed = True
    while changed:
        changed = False
        for suffix in suffixes:
            next_cleaned = re.sub(suffix, "", cleaned, flags=re.IGNORECASE).strip()
            if next_cleaned != cleaned:
                cleaned = next_cleaned
                changed = True

    return cleaned


def parse_song_title(video_title: str) -> ParsedSongTitle:
    cleaned = clean_video_title(video_title)

    if " - " in cleaned:
        artist, title = cleaned.split(" - ", 1)
        if artist.strip() and title.strip():
            return ParsedSongTitle(artist=artist.strip(), title=title.strip())

    return ParsedSongTitle(artist="", title=cleaned)


def fetch_oembed_metadata(yt_id: str) -> dict:
    query = urlencode(
        {
            "url": f"https://www.youtube.com/watch?v={yt_id}",
            "format": "json",
        }
    )
    url = f"https://www.youtube.com/oembed?{query}"

    try:
        with urlopen(url, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise YouTubeMetadataError("Could not fetch YouTube metadata") from exc


def get_youtube_song_suggestion(yt_id: str) -> dict:
    if not is_valid_youtube_id(yt_id):
        raise ValueError("yt_id must be an 11-character YouTube ID")

    metadata = fetch_oembed_metadata(yt_id)
    source_title = metadata.get("title", "").strip()
    if not source_title:
        raise YouTubeMetadataError("YouTube metadata did not include a title")

    parsed = parse_song_title(source_title)

    return {
        "s_yt_id": yt_id,
        "s_artist": parsed.artist,
        "s_title": parsed.title,
        "s_album": None,
        "s_released": None,
        "s_discovered": str(datetime.now().year),
        "source_title": source_title,
        "source_channel": metadata.get("author_name", ""),
        "thumbnail_url": metadata.get("thumbnail_url", ""),
    }
