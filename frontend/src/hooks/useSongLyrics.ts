import { useCallback, useEffect, useState } from "react";
import { fetchSongLyrics, LyricsPayload } from "../api/lyricsService";
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
  const songId = song?.id ?? null;
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = song
    ? JSON.stringify([
        song.id,
        song.s_title,
        song.s_artist,
        song.s_album,
        song.s_yt_id,
        roundedDuration,
        reloadCount,
      ])
    : null;
  const [state, setState] = useState<LyricsState>({
    requestKey: null,
    lyrics: null,
    status: "idle",
  });

  useEffect(() => {
    if (!requestKey || songId === null) {
      setState({ requestKey: null, lyrics: null, status: "idle" });
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timer: number | undefined;
    setState({ requestKey, lyrics: null, status: "loading" });

    const load = () => {
      fetchSongLyrics(songId, roundedDuration, controller.signal)
        .then((payload) => {
          if (cancelled) return;
          setState({ requestKey, lyrics: payload, status: "ready" });
        })
        .catch((error) => {
          if (cancelled || error?.name === "AbortError") return;
          setState({ requestKey, lyrics: null, status: "error" });
        });
    };

    // Stored lyrics do not need the duration, but live lookups match on it.
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
  }, [requestKey, roundedDuration, songId]);

  /** Show what the server returned after saving, if it is still the current song. */
  const replaceLyrics = useCallback(
    (forSongId: number, payload: LyricsPayload) => {
      if (forSongId !== songId) return;
      setState((previous) =>
        previous.requestKey === requestKey
          ? { requestKey, lyrics: payload, status: "ready" }
          : previous
      );
    },
    [requestKey, songId]
  );

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  if (!requestKey) {
    return { lyrics: null, status: "idle" as LyricsStatus, replaceLyrics, reload };
  }
  if (state.requestKey !== requestKey) {
    return { lyrics: null, status: "loading" as LyricsStatus, replaceLyrics, reload };
  }
  return { lyrics: state.lyrics, status: state.status, replaceLyrics, reload };
}
