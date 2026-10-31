import { useCallback, useEffect, useRef, useState } from "react";
import { updateSongLyricsOffset } from "../api/songService";
import type { Song } from "../components/Song";

export const MAX_LYRICS_OFFSET_MS = 5 * 60 * 1000;
const SAVE_DELAY_MS = 600;

export type LyricsOffsetSaveStatus = "idle" | "saving" | "error";

interface PendingSave {
  songId: number;
  offsetMs: number;
  fingerprint: string;
  timer: number;
}

/**
 * Per-song lyrics offset in milliseconds (positive shows lyrics later). A stored
 * offset only applies to the lyrics fingerprint it was saved with.
 */
export function useLyricsOffset(song: Song | null, fingerprint: string | null | undefined) {
  const key = song && fingerprint ? `${song.id}:${fingerprint}` : null;
  const storedOffsetMs =
    song && fingerprint && song.s_lyrics_offset_ref === fingerprint
      ? song.s_lyrics_offset_ms ?? 0
      : 0;
  // Song objects in the ranking list are not refetched after a save, so the
  // values set in this session take precedence over the stored ones.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<LyricsOffsetSaveStatus>("idle");
  const pendingRef = useRef<PendingSave | null>(null);
  const saveSequenceRef = useRef(0);

  const offsetMs = key !== null && key in overrides ? overrides[key] : storedOffsetMs;

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingRef.current = null;

    const sequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = sequence;
    setSaveStatus("saving");
    updateSongLyricsOffset(pending.songId, pending.offsetMs, pending.fingerprint)
      .then(() => {
        if (saveSequenceRef.current === sequence) setSaveStatus("idle");
      })
      .catch((error) => {
        console.error("Could not save lyrics offset:", error);
        if (saveSequenceRef.current === sequence) setSaveStatus("error");
      });
  }, []);

  useEffect(() => {
    setSaveStatus("idle");
    return flush;
  }, [key, flush]);

  const setOffset = useCallback(
    (nextOffsetMs: number) => {
      if (!song || !fingerprint || key === null) return;
      const clamped = Math.max(
        -MAX_LYRICS_OFFSET_MS,
        Math.min(MAX_LYRICS_OFFSET_MS, Math.round(nextOffsetMs))
      );
      setOverrides((previous) => ({ ...previous, [key]: clamped }));

      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = {
        songId: song.id,
        offsetMs: clamped,
        fingerprint,
        timer: window.setTimeout(flush, SAVE_DELAY_MS),
      };
    },
    [fingerprint, flush, key, song]
  );

  const adjust = useCallback(
    (deltaMs: number) => setOffset(offsetMs + deltaMs),
    [offsetMs, setOffset]
  );
  const reset = useCallback(() => setOffset(0), [setOffset]);

  return { offsetMs, canAdjust: key !== null, adjust, reset, saveStatus };
}
