import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchLyricsCandidates,
  forgetSongLyrics,
  LyricsCandidate,
  LyricsPayload,
  saveSongLyrics,
  StoredLyricsInput,
} from "../api/lyricsService";
import type { Song } from "../components/Song";

export const MAX_LYRICS_OFFSET_MS = 5 * 60 * 1000;
const SAVE_DELAY_MS = 600;

export type LyricsSaveStatus = "idle" | "saving" | "error";
export type CandidatesStatus = "idle" | "loading" | "ready" | "error";

interface LyricsEditorOptions {
  enabled: boolean;
  durationSeconds?: number | null;
  onSaved?: (songId: number, payload: LyricsPayload) => void;
  onForgotten?: () => void;
}

interface PendingSave {
  songId: number;
  input: StoredLyricsInput;
  timer: number;
}

interface CandidatesState {
  songId: number | null;
  status: CandidatesStatus;
  list: LyricsCandidate[];
  incomplete: boolean;
}

const NO_CANDIDATES: CandidatesState = { songId: null, status: "idle", list: [], incomplete: false };

/** Two payloads with the same identity are the same lyrics file. */
function lyricsIdentity(lyrics: LyricsPayload | null): string | null {
  if (!lyrics?.found) return null;
  if (lyrics.instrumental) return "instrumental";
  if (lyrics.synced) return `synced:${lyrics.fingerprint ?? ""}`;
  return `plain:${(lyrics.plain ?? "").replace(/\s+/g, " ").trim()}`;
}

function toStoredInput(lyrics: LyricsPayload, offsetMs: number): StoredLyricsInput {
  return {
    provider: lyrics.provider ?? "unknown",
    source_id: lyrics.source_id ?? lyrics.stored?.source_id ?? "",
    instrumental: lyrics.instrumental,
    lines: lyrics.lines,
    plain: lyrics.plain,
    offset_ms: lyrics.synced ? offsetMs : 0,
  };
}

/**
 * The lyrics shown in the player and how a logged-in user can change them:
 * browse other candidates, adjust the timing (positive shows lines later),
 * keep the shown lyrics for the song, or forget the saved ones. Stored lyrics
 * bring their offset back next time.
 */
export function useLyricsEditor(
  song: Song | null,
  loadedLyrics: LyricsPayload | null,
  { enabled, durationSeconds = null, onSaved, onForgotten }: LyricsEditorOptions
) {
  const songId = song?.id ?? null;
  const [candidatesState, setCandidatesState] = useState<CandidatesState>(NO_CANDIDATES);
  const [selection, setSelection] = useState<{ songId: number; id: string } | null>(null);
  // Adjustments made in this session win over the loaded offset while saves
  // are pending or in flight.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<LyricsSaveStatus>("idle");
  const pendingRef = useRef<PendingSave | null>(null);
  const sequenceRef = useRef(0);
  const pendingStepRef = useRef(0);
  const onSavedRef = useRef(onSaved);
  const onForgottenRef = useRef(onForgotten);
  onSavedRef.current = onSaved;
  onForgottenRef.current = onForgotten;

  const candidates = candidatesState.songId === songId ? candidatesState : NO_CANDIDATES;
  const loadedIdentity = lyricsIdentity(loadedLyrics);
  const selected =
    selection && selection.songId === songId
      ? candidates.list.find((candidate) => candidate.id === selection.id) ?? null
      : null;
  const lyrics: LyricsPayload | null = useMemo(
    () =>
      selected
        ? {
            ...selected,
            stored: lyricsIdentity(selected) === loadedIdentity ? loadedLyrics?.stored ?? null : null,
          }
        : loadedLyrics,
    [loadedIdentity, loadedLyrics, selected]
  );
  const identity = lyricsIdentity(lyrics);
  const position = candidates.list.findIndex((candidate) => lyricsIdentity(candidate) === identity);
  const key = songId !== null && identity !== null ? `${songId}:${identity}` : null;

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
    (forSongId: number, input: StoredLyricsInput) => {
      track(
        saveSongLyrics(forSongId, input).then((payload) => {
          onSavedRef.current?.(forSongId, payload);
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

  useEffect(() => {
    pendingStepRef.current = 0;
  }, [songId]);

  const select = useCallback(
    (list: LyricsCandidate[], fromPosition: number, step: number) => {
      if (songId === null || list.length === 0) return;
      const start = fromPosition >= 0 ? fromPosition : step > 0 ? -1 : 0;
      const next = list[(start + step + list.length * 2) % list.length];
      setSelection(lyricsIdentity(next) === loadedIdentity ? null : { songId, id: next.id });
    },
    [loadedIdentity, songId]
  );

  const showCandidate = useCallback(
    (step: 1 | -1) => {
      if (!enabled || songId === null) return;
      if (candidates.status === "ready") {
        select(candidates.list, position, step);
        return;
      }
      pendingStepRef.current = step;
      if (candidates.status === "loading") return;

      const forSongId = songId;
      setCandidatesState({ songId: forSongId, status: "loading", list: [], incomplete: false });
      fetchLyricsCandidates(forSongId, durationSeconds)
        .then(({ candidates: list, incomplete }) => {
          setCandidatesState((previous) =>
            previous.songId === forSongId ? { songId: forSongId, status: "ready", list, incomplete } : previous
          );
          const pendingStep = pendingStepRef.current;
          pendingStepRef.current = 0;
          if (pendingStep !== 0) {
            const from = list.findIndex((candidate) => lyricsIdentity(candidate) === loadedIdentity);
            select(list, from, pendingStep);
          }
        })
        .catch((error) => {
          console.error("Could not load other lyrics:", error);
          setCandidatesState((previous) =>
            previous.songId === forSongId ? { ...previous, status: "error" } : previous
          );
        });
    },
    [candidates, durationSeconds, enabled, loadedIdentity, position, select, songId]
  );

  const showNextCandidate = useCallback(() => showCandidate(1), [showCandidate]);
  const showPreviousCandidate = useCallback(() => showCandidate(-1), [showCandidate]);

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
        setSelection(null);
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
    canEdit: enabled && song !== null && loadedLyrics !== null,
    canKeep: enabled && song !== null && !!lyrics?.found,
    canAdjustTiming: enabled && key !== null && !!lyrics?.synced,
    saveStatus,
    adjust,
    resetOffset,
    keep,
    forget,
    candidates: {
      status: candidates.status,
      total: candidates.list.length,
      position: position >= 0 ? position + 1 : null,
      incomplete: candidates.incomplete,
      current: selected ?? (position >= 0 ? candidates.list[position] : null),
    },
    showNextCandidate,
    showPreviousCandidate,
  };
}

export type LyricsEditor = ReturnType<typeof useLyricsEditor>;
