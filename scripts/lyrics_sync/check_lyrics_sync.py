"""Check whether songs' synced lyrics match their YouTube audio, and optionally
store the correction as each song's lyrics offset.

For every song in a ranking the script asks the Toplista API for the lyrics
exactly as the player gets them, downloads the video's audio, transcribes it
with Whisper (word timestamps) and finds the single time shift that lines up
the most lyrics lines with what is actually sung. A positive shift means the
lyrics would light up too early; the player's stored offset uses the same sign.

The dependencies are heavy and not needed by the web app, so install them in a
separate environment (Node.js or Deno must be installed for YouTube downloads):

    python -m venv scripts/lyrics_sync/.venv
    scripts/lyrics_sync/.venv/Scripts/python -m pip install -r scripts/lyrics_sync/requirements.txt

Dry run against a local backend, then store offsets through another API:

    python scripts/lyrics_sync/check_lyrics_sync.py --ranking main
    python scripts/lyrics_sync/check_lyrics_sync.py --api https://example.com/toplista/backend/api/ --apply

--apply logs in as --username with the password from TOPLISTA_PASSWORD or a
prompt. Songs that already have an offset for the current lyrics are skipped
unless --overwrite is given. Audio and transcripts are cached in --cache-dir.
Expect roughly 20-40 s per song with synced lyrics on a GPU.
"""
from __future__ import annotations

import argparse
import collections
import csv
import getpass
import json
import os
import re
import statistics
import sys
import sysconfig
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from rapidfuzz import fuzz

SAMPLE_RATE = 16_000
MATCH_TOLERANCE_S = 1.5
SEARCH_RANGE_S = 120.0
SEARCH_STEP_S = 0.25
MIN_MATCH_SCORE = 72
MAX_DRIFT_S = 2.0
# The production host throttles Python's default user agent after one request.
USER_AGENT = "Toplista-lyrics-sync/1.0 (https://github.com/nocawy/toplista)"
EN_WORDS = {"the", "you", "and", "i", "me", "my", "to", "a", "it", "in", "is", "of", "on", "your", "we", "be", "love", "all"}


def normalize(text: str) -> str:
    text = text.lower().replace("ł", "l")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9' ]+", " ", text).replace("'", "")
    return " ".join(text.split())


def guess_language(lines: list[dict]) -> str | None:
    """Whisper often misdetects the language during instrumental intros."""
    text = " ".join(line["text"] for line in lines)
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", text):
        return "ja"
    if re.search(r"[\u0400-\u04ff]", text):
        return "ru"
    if len(re.findall(r"[ąćęłńśźż]", text.lower())) >= 3:
        return "pl"
    words = re.findall(r"[a-z']+", text.lower())
    if words and sum(word in EN_WORDS for word in words) / len(words) > 0.12:
        return "en"
    return None


@dataclass(frozen=True)
class Alignment:
    offset_s: float
    matched: int
    eligible: int
    drift_s: float

    @property
    def conclusive(self) -> bool:
        return self.matched >= max(4, 0.25 * self.eligible)


def _slope(points: list[tuple[float, float]]) -> float:
    mean_x = statistics.fmean(x for x, _ in points)
    mean_y = statistics.fmean(y for _, y in points)
    variance = sum((x - mean_x) ** 2 for x, _ in points)
    if variance == 0:
        return 0.0
    return sum((x - mean_x) * (y - mean_y) for x, y in points) / variance


def _is_matchable(line_text: str) -> bool:
    return len(line_text.split()) >= 3 and len(line_text) >= 10


def _line_candidates(line_text: str, words: list[str], starts: list[float]) -> list[tuple[float, float]]:
    """(start time, score) of transcript windows that read like the line; choruses repeat."""
    size = len(line_text.split())
    hits: list[tuple[int, float]] = []
    for window in {max(1, size - 1), size, size + 1}:
        for index in range(0, max(0, len(words) - window + 1)):
            score = fuzz.ratio(line_text, " ".join(words[index:index + window]))
            if score >= MIN_MATCH_SCORE:
                hits.append((index, score))
    hits.sort(key=lambda hit: -hit[1])
    kept: list[tuple[int, float]] = []
    for index, score in hits:
        if all(abs(index - other) > size for other, _ in kept):
            kept.append((index, score))
    return [(starts[index], score) for index, score in kept]


def align(lines: list[dict], words: list[dict]) -> Alignment | None:
    """Find the shift (seconds) between LRC lines ({start_ms, text}) and
    transcribed words ({word, start}) that explains the most lines."""
    transcript: list[str] = []
    starts: list[float] = []
    for word in words:
        for part in normalize(word["word"]).split():
            transcript.append(part)
            starts.append(float(word["start"]))

    eligible_times: list[float] = []
    lines_with_candidates: list[tuple[float, list[tuple[float, float]]]] = []
    for line in lines:
        text = normalize(line["text"])
        if not _is_matchable(text):
            continue
        lrc_s = line["start_ms"] / 1000
        eligible_times.append(lrc_s)
        candidates = [(start - lrc_s, score) for start, score in _line_candidates(text, transcript, starts)]
        if candidates:
            lines_with_candidates.append((lrc_s, candidates))
    if not lines_with_candidates:
        return None

    best_votes, best_shift = 0.0, 0.0
    steps = int(SEARCH_RANGE_S / SEARCH_STEP_S)
    for step in range(-steps, steps + 1):
        shift = step * SEARCH_STEP_S
        votes = 0.0
        for _, candidates in lines_with_candidates:
            scores = [score for offset, score in candidates if abs(offset - shift) <= MATCH_TOLERANCE_S]
            if scores:
                votes += max(scores)
        if votes > best_votes:
            best_votes, best_shift = votes, shift
    if best_votes == 0:
        return None

    matched = []
    for lrc_s, candidates in lines_with_candidates:
        nearest = min((offset for offset, _ in candidates), key=lambda offset: abs(offset - best_shift))
        if abs(nearest - best_shift) <= MATCH_TOLERANCE_S:
            matched.append((lrc_s, nearest))
    # A tempo mismatch shows up as a trend in the offsets across matched lines.
    matched_span_s = max(lrc_s for lrc_s, _ in matched) - min(lrc_s for lrc_s, _ in matched)
    return Alignment(
        offset_s=statistics.median(offset for _, offset in matched),
        matched=len(matched),
        eligible=len(eligible_times),
        drift_s=abs(_slope(matched)) * matched_span_s,
    )


def verdict(alignment: Alignment | None, min_offset_s: float) -> str:
    if alignment is None or not alignment.conclusive:
        return "inconclusive"
    if alignment.drift_s > MAX_DRIFT_S:
        return "drifting"
    if abs(alignment.offset_s) < min_offset_s:
        return "in sync"
    return "out of sync"


class ApiError(Exception):
    pass


class ToplistaApi:
    def __init__(self, base_url: str):
        self.base_url = base_url if base_url.endswith("/") else f"{base_url}/"
        self.access: str | None = None
        self.refresh: str | None = None

    def login(self, username: str, password: str) -> None:
        tokens = self._request("POST", "login/", {"username": username, "password": password})
        self.access, self.refresh = tokens["access"], tokens.get("refresh")

    def songs(self, ranking: str) -> list[dict]:
        return self._request("GET", f"songs/?{urllib.parse.urlencode({'list': ranking})}")

    def lyrics(self, song: dict, duration_s: float | None) -> dict:
        params = {"title": song["s_title"]}
        if song.get("s_artist"):
            params["artist"] = song["s_artist"]
        if song.get("s_album"):
            params["album"] = song["s_album"]
        params["yt_id"] = song["s_yt_id"]
        if duration_s and duration_s > 0:
            params["duration"] = str(round(duration_s))
        return self._request("GET", f"lyrics/?{urllib.parse.urlencode(params)}")

    def save_offset(self, song_id: int, offset_ms: int, fingerprint: str) -> None:
        self._request(
            "PATCH",
            f"songs/update/{song_id}",
            {"s_lyrics_offset_ms": offset_ms, "s_lyrics_offset_ref": fingerprint if offset_ms else ""},
            auth=True,
        )

    def _refresh_access(self) -> None:
        tokens = self._request("POST", "token/refresh/", {"refresh": self.refresh})
        self.access = tokens["access"]
        self.refresh = tokens.get("refresh", self.refresh)

    def _request(self, method: str, path: str, body: dict | None = None, auth: bool = False):
        url = urllib.parse.urljoin(self.base_url, path)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        refreshed = False
        for _ in range(6):
            headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
            if data is not None:
                headers["Content-Type"] = "application/json"
            if auth and self.access:
                headers["Authorization"] = f"Bearer {self.access}"
            request = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    raw = response.read()
                return json.loads(raw) if raw else None
            except urllib.error.HTTPError as exc:
                if exc.code == 429:
                    time.sleep(min(float(exc.headers.get("Retry-After") or 10), 120))
                    continue
                if exc.code == 401 and auth and self.refresh and not refreshed:
                    self._refresh_access()
                    refreshed = True
                    continue
                detail = exc.read()[:200].decode("utf-8", "replace")
                raise ApiError(f"{method} {path}: HTTP {exc.code} {detail}") from exc
        raise ApiError(f"{method} {path}: still throttled after several retries")


def _add_windows_cuda_dll_dirs() -> None:
    if sys.platform != "win32":
        return
    cublas_bin = Path(sysconfig.get_paths()["purelib"]) / "nvidia" / "cublas" / "bin"
    if cublas_bin.is_dir():
        os.add_dll_directory(str(cublas_bin))
        os.environ["PATH"] = f"{cublas_bin}{os.pathsep}{os.environ['PATH']}"


class Transcriber:
    def __init__(self, model_name: str, device: str, cache_dir: Path):
        self.model_name = model_name
        self.device = device
        self.cache_dir = cache_dir / "transcripts"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._model = None
        self._model_device: str | None = None

    def transcribe(self, yt_id: str, audio, language: str | None) -> dict:
        cache = self.cache_dir / f"{yt_id}.{self.model_name}.{language or 'auto'}.json"
        if cache.exists():
            return json.loads(cache.read_text(encoding="utf-8"))
        if self._model is None:
            self._load("cpu" if self.device == "cpu" else "cuda")
        try:
            result = self._run(audio, language)
        except RuntimeError as exc:
            # CUDA libraries load lazily, so a missing runtime only shows up here.
            if self.device != "auto" or self._model_device != "cuda":
                raise
            print(f"  CUDA failed ({exc}); continuing on CPU", file=sys.stderr)
            self._load("cpu")
            result = self._run(audio, language)
        cache.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return result

    def _load(self, device: str) -> None:
        from faster_whisper import WhisperModel

        if device == "cuda":
            _add_windows_cuda_dll_dirs()
            try:
                self._model = WhisperModel(self.model_name, device="cuda", compute_type="float16")
                self._model_device = "cuda"
                return
            except Exception as exc:  # noqa: BLE001
                if self.device != "auto":
                    raise
                print(f"  CUDA unavailable ({exc}); using CPU", file=sys.stderr)
        self._model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        self._model_device = "cpu"

    def _run(self, audio, language: str | None) -> dict:
        segments, info = self._model.transcribe(
            audio,
            language=language,
            word_timestamps=True,
            condition_on_previous_text=False,
            beam_size=5,
            language_detection_segments=6,
        )
        words = [
            {"word": word.word, "start": round(word.start, 2)}
            for segment in segments
            for word in segment.words or []
        ]
        return {"language": info.language, "words": words}


class YouTubeAudio:
    def __init__(self, cache_dir: Path):
        import yt_dlp

        self.audio_dir = cache_dir / "audio"
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self._ydl = yt_dlp.YoutubeDL(
            {
                "quiet": True,
                "noprogress": True,
                "no_warnings": True,
                "noplaylist": True,
                "format": "bestaudio[ext=m4a]/bestaudio",
                "outtmpl": str(self.audio_dir / "%(id)s.%(ext)s"),
                "js_runtimes": {"deno": {}, "node": {}},
            }
        )

    def duration(self, yt_id: str) -> tuple[float | None, dict]:
        info = self._ydl.extract_info(f"https://www.youtube.com/watch?v={yt_id}", download=False)
        return info.get("duration"), info

    def download(self, yt_id: str, info: dict) -> Path:
        cached = self._cached(yt_id)
        if cached is None:
            self._ydl.process_ie_result(info, download=True)
            cached = self._cached(yt_id)
        if cached is None:
            raise RuntimeError("audio download produced no file")
        return cached

    def _cached(self, yt_id: str) -> Path | None:
        for path in self.audio_dir.glob(f"{yt_id}.*"):
            if path.suffix not in {".part", ".ytdl"}:
                return path
        return None


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:8000/api/", help="Toplista API base URL")
    parser.add_argument("--ranking", default="main", help="ranking slug to check (default: main)")
    parser.add_argument("--song-id", type=int, action="append", help="only check this song id (repeatable)")
    parser.add_argument("--limit", type=int, help="check at most this many songs")
    parser.add_argument("--apply", action="store_true", help="store measured offsets (requires login)")
    parser.add_argument("--overwrite", action="store_true", help="replace offsets already set for the same lyrics")
    parser.add_argument("--username", default="admin", help="login for --apply (default: admin)")
    parser.add_argument(
        "--min-offset", type=float, default=1.0, help="store only offsets of at least this many seconds"
    )
    parser.add_argument("--model", default="large-v3-turbo", help="faster-whisper model name")
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    parser.add_argument(
        "--cache-dir", type=Path, default=Path.home() / ".cache" / "toplista-lyrics-sync"
    )
    parser.add_argument("--report", type=Path, help="write per-song results to this CSV file")
    return parser.parse_args(argv)


def check_song(song: dict, args, api: ToplistaApi, youtube: YouTubeAudio, transcriber: Transcriber) -> dict:
    row = {"song_id": song["id"], "artist": song.get("s_artist") or "", "title": song["s_title"], "yt_id": song["s_yt_id"]}

    duration_s, info = youtube.duration(song["s_yt_id"])
    lyrics = api.lyrics(song, duration_s)
    row["provider"] = lyrics.get("provider") or ""
    if not lyrics.get("synced") or not lyrics.get("lines"):
        return {**row, "verdict": "no synced lyrics"}
    fingerprint = lyrics.get("fingerprint")
    if not fingerprint:
        return {**row, "verdict": "skipped", "action": "API returns no lyrics fingerprint; update the backend"}

    stored_ms = song.get("s_lyrics_offset_ms") or 0
    if song.get("s_lyrics_offset_ref") == fingerprint and stored_ms and not args.overwrite:
        return {**row, "verdict": "skipped", "action": f"keeps offset {stored_ms / 1000:+.1f} s"}

    from faster_whisper import decode_audio

    audio = decode_audio(str(youtube.download(song["s_yt_id"], info)), sampling_rate=SAMPLE_RATE)
    transcript = transcriber.transcribe(song["s_yt_id"], audio, guess_language(lyrics["lines"]))
    alignment = align(lyrics["lines"], transcript["words"])
    result = verdict(alignment, args.min_offset)
    if alignment is not None:
        row.update(
            offset_s=round(alignment.offset_s, 2),
            matched=f"{alignment.matched}/{alignment.eligible}",
            drift_s=round(alignment.drift_s, 2),
        )
    row["verdict"] = result

    if result == "out of sync":
        target_ms = int(round(alignment.offset_s * 10)) * 100
    elif result == "in sync" and args.overwrite and stored_ms and song.get("s_lyrics_offset_ref") == fingerprint:
        target_ms = 0
    else:
        return row
    if args.apply:
        api.save_offset(song["id"], target_ms, fingerprint)
        row["action"] = f"saved {target_ms / 1000:+.1f} s"
    else:
        row["action"] = f"would save {target_ms / 1000:+.1f} s"
    return row


def describe(row: dict) -> str:
    parts = [row["verdict"]]
    if "offset_s" in row:
        parts.append(f"offset {row['offset_s']:+.2f} s (matched {row['matched']} lines, drift {row['drift_s']:.2f} s)")
    if row.get("action"):
        parts.append(row["action"])
    return ", ".join(parts)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    api = ToplistaApi(args.api)
    if args.apply:
        password = os.environ.get("TOPLISTA_PASSWORD") or getpass.getpass(f"Password for {args.username}: ")
        api.login(args.username, password)

    songs = api.songs(args.ranking)
    if args.song_id:
        wanted = set(args.song_id)
        songs = [song for song in songs if song["id"] in wanted]
    if args.limit:
        songs = songs[: args.limit]

    youtube = YouTubeAudio(args.cache_dir)
    transcriber = Transcriber(args.model, args.device, args.cache_dir)
    rows = []
    for index, song in enumerate(songs, start=1):
        label = f"[{index}/{len(songs)}] {song.get('s_artist') or '-'} - {song['s_title']} ({song['s_yt_id']})"
        try:
            row = check_song(song, args, api, youtube, transcriber)
        except Exception as exc:  # noqa: BLE001
            row = {"song_id": song["id"], "title": song["s_title"], "yt_id": song["s_yt_id"], "verdict": "error", "action": str(exc)[:200]}
        rows.append(row)
        print(f"{label}: {describe(row)}", flush=True)

    counts = collections.Counter(row["verdict"] for row in rows)
    print("\nSummary: " + ", ".join(f"{verdict_name} {count}" for verdict_name, count in counts.most_common()))
    if args.report:
        columns = ["song_id", "artist", "title", "yt_id", "provider", "verdict", "offset_s", "matched", "drift_s", "action"]
        with args.report.open("w", newline="", encoding="utf-8") as report:
            writer = csv.DictWriter(report, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        print(f"Report written to {args.report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
