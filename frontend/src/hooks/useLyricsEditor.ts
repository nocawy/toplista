import { useCallback, useEffect, useRef, useState } from "react";
import {
  forgetSongLyrics,
  LyricsPayload,
  saveSongLyrics,
  StoredLyricsInput,
} from "../api/lyricsService";
import type { Song } from "../components/Song";

export const MAX_LYRICS_OFFSET_MS = 5 * 60 * 1000;
const SAVE_DELAY_MS = 600;

export type LyricsSaveStatus = "idle" | "saving" | "error";

interface LyricsEditorOptions {
  enabled: boolean;
  onSaved?: (songId: number, payload: LyricsPayload) => void;
  onForgotten?: () => void;
}

interface PendingSave {
  songId: number;
  input: StoredLyricsInput;
  timer: number;
}

function lyricsKey(song: Song | null, lyrics: LyricsPayload | null): string | null {
  if (!song || !lyrics?.found) return null;
  return `${song.id}:${lyrics.fingerprint ?? lyrics.provider ?? ""}`;
}

function toStoredInput(lyrics: LyricsPayload, offsetMs: number): StoredLyricsInput {
  return {
    provider: lyrics.provider ?? "unknown",
    source_id: lyrics.stored?.source_id ?? "",
    instrumental: lyrics.instrumental,
    lines: lyrics.lines,
    plain: lyrics.plain,
    offset_ms: lyrics.synced ? offsetMs : 0,
  };
}

/**
 * Timing and saving for the lyrics shown in the player. Saving stores the
 * shown lyrics for the song together with their offset (positive shows the
 * lines later); stored lyrics bring their offset back next time.
 */
export function useLyricsEditor(
  song: Song | null,
  lyrics: LyricsPayload | null,
  { enabled, onSaved, onForgotten }: LyricsEditorOptions
) {
  const key = lyricsKey(song, lyrics);
  // Adjustments made in this session win over the loaded offset while saves
  // are pending or in flight.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<LyricsSaveStatus>("idle");
  const pendingRef = useRef<PendingSave | null>(null);
  const sequenceRef = useRef(0);
  const onSavedRef = useRef(onSaved);
  const onForgottenRef = useRef(onForgotten);
  onSavedRef.current = onSaved;
  onForgottenRef.current = onForgotten;

  const offsetMs = lyrics?.synced
    ? key !== null && key in overrides
      ? overrides[key]
      : lyrics.stored?.offset_ms ?? 0
    : 0;

  const track = useCallback((request: Promise<void>) => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    setSaveStatus("saving");
    request
      .then(() => {
        if (sequenceRef.current === sequence) setSaveStatus("idle");
      })
      .catch((error) => {
        console.error("Could not save lyrics:", error);
        if (sequenceRef.current === sequence) setSaveStatus("error");
      });
  }, []);

  const save = useCallback(
    (songId: number, input: StoredLyricsInput) => {
      track(
        saveSongLyrics(songId, input).then((payload) => {
          onSavedRef.current?.(songId, payload);
        })
      );
    },
    [track]
  );

  const cancelPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) window.clearTimeout(pending.timer);
    pendingRef.current = null;
    return pending;
  }, []);

  const flush = useCallback(() => {
    const pending = cancelPending();
    if (pending) save(pending.songId, pending.input);
  }, [cancelPending, save]);

  useEffect(() => {
    setSaveStatus("idle");
    return flush;
  }, [key, flush]);

  const adjust = useCallback(
    (deltaMs: number) => {
      if (!enabled || !song || !lyrics?.synced || key === null) return;
      const next = Math.max(
        -MAX_LYRICS_OFFSET_MS,
        Math.min(MAX_LYRICS_OFFSET_MS, Math.round(offsetMs + deltaMs))
      );
      setOverrides((previous) => ({ ...previous, [key]: next }));
      cancelPending();
      pendingRef.current = {
        songId: song.id,
        input: toStoredInput(lyrics, next),
        timer: window.setTimeout(flush, SAVE_DELAY_MS),
      };
    },
    [cancelPending, enabled, flush, key, lyrics, offsetMs, song]
  );

  const resetOffset = useCallback(() => adjust(-offsetMs), [adjust, offsetMs]);

  const keep = useCallback(() => {
    if (!enabled || !song || !lyrics?.found) return;
    cancelPending();
    save(song.id, toStoredInput(lyrics, offsetMs));
  }, [cancelPending, enabled, lyrics, offsetMs, save, song]);

  const forget = useCallback(() => {
    if (!enabled || !song) return;
    cancelPending();
    const prefix = `${song.id}:`;
    track(
      forgetSongLyrics(song.id).then(() => {
        setOverrides((previous) =>
          Object.fromEntries(Object.entries(previous).filter(([entry]) => !entry.startsWith(prefix)))
        );
        onForgottenRef.current?.();
      })
    );
  }, [cancelPending, enabled, song, track]);

  return {
    lyrics,
    offsetMs,
    stored: lyrics?.stored ?? null,
    canEdit: enabled && key !== null,
    canAdjustTiming: enabled && key !== null && !!lyrics?.synced,
    saveStatus,
    adjust,
    resetOffset,
    keep,
    forget,
  };
}

export type LyricsEditor = ReturnType<typeof useLyricsEditor>;
