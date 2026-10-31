import apiClient from "./apiClient";
import type { LyricsLine } from "../utils/lyrics";

export type StoredLyricsStatus = "manual" | "verified";

export interface StoredLyricsInfo {
  status: StoredLyricsStatus;
  offset_ms: number;
  source_id: string;
  updated_on: string;
}

export interface LyricsPayload {
  found: boolean;
  provider: string | null;
  instrumental: boolean;
  synced: boolean;
  lines: LyricsLine[];
  plain: string | null;
  fingerprint?: string | null;
  /** Set when these lyrics were chosen and saved for the song. */
  stored?: StoredLyricsInfo | null;
}

export interface StoredLyricsInput {
  provider: string;
  source_id: string;
  instrumental: boolean;
  lines: LyricsLine[];
  plain: string | null;
  offset_ms: number;
}

export const fetchSongLyrics = async (
  songId: number,
  duration: number | null,
  signal?: AbortSignal
): Promise<LyricsPayload> => {
  const params = new URLSearchParams();
  if (duration && duration > 0) {
    params.set("duration", String(Math.round(duration)));
  }
  const query = params.toString();
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}songs/${songId}/lyrics/${query ? `?${query}` : ""}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error("Lyrics lookup failed");
  }
  return response.json();
};

export const saveSongLyrics = async (
  songId: number,
  lyrics: StoredLyricsInput
): Promise<LyricsPayload> => {
  const response = await apiClient.put(`songs/${songId}/lyrics/`, lyrics);
  return response.data;
};

export const forgetSongLyrics = async (songId: number): Promise<void> => {
  await apiClient.delete(`songs/${songId}/lyrics/`);
};
