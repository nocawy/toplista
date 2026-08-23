import { useEffect, useState } from "react";
import { fetchLyrics, LyricsPayload } from "../api/lyricsService";
import type { Song } from "../components/Song";

type LyricsStatus = "idle" | "loading" | "ready" | "error";

interface LyricsState {
  requestKey: string | null;
  lyrics: LyricsPayload | null;
  status: LyricsStatus;
}

const DURATION_WAIT_MS = 1200;

export function useSongLyrics(song: Song | null, durationSeconds: number | null) {
  const roundedDuration =
    durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : null;
  const title = song?.s_title ?? "";
  const artist = song?.s_artist ?? null;
  const album = song?.s_album ?? null;
  const ytId = song?.s_yt_id ?? null;
  const requestKey = song
    ? JSON.stringify([song.id, title, artist, album, ytId, roundedDuration])
    : null;
  const [state, setState] = useState<LyricsState>({
    requestKey: null,
    lyrics: null,
    status: "idle",
  });

  useEffect(() => {
    if (!requestKey) {
      setState({ requestKey: null, lyrics: null, status: "idle" });
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timer: number | undefined;
    setState({ requestKey, lyrics: null, status: "loading" });

    const load = () => {
      fetchLyrics(
        {
          title,
          artist,
          album,
          duration: roundedDuration,
          ytId,
        },
        controller.signal
      )
        .then((payload) => {
          if (cancelled) return;
          setState({ requestKey, lyrics: payload, status: "ready" });
        })
        .catch((error) => {
          if (cancelled || error?.name === "AbortError") return;
          setState({ requestKey, lyrics: null, status: "error" });
        });
    };

    if (roundedDuration) {
      load();
    } else {
      timer = window.setTimeout(load, DURATION_WAIT_MS);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [album, artist, requestKey, roundedDuration, title, ytId]);

  if (!requestKey) {
    return { lyrics: null, status: "idle" as LyricsStatus };
  }
  if (state.requestKey !== requestKey) {
    return { lyrics: null, status: "loading" as LyricsStatus };
  }
  return { lyrics: state.lyrics, status: state.status };
}
