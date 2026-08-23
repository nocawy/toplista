import type { LyricsLine } from "../utils/lyrics";

export interface LyricsPayload {
  found: boolean;
  provider: string | null;
  instrumental: boolean;
  synced: boolean;
  lines: LyricsLine[];
  plain: string | null;
}

export interface LyricsQuery {
  title: string;
  artist?: string | null;
  album?: string | null;
  duration?: number | null;
  ytId?: string | null;
}

export const fetchLyrics = async (
  query: LyricsQuery,
  signal?: AbortSignal
): Promise<LyricsPayload> => {
  const params = new URLSearchParams();
  params.set("title", query.title);
  if (query.artist) params.set("artist", query.artist);
  if (query.album) params.set("album", query.album);
  if (query.ytId) params.set("yt_id", query.ytId);
  if (query.duration && query.duration > 0) {
    params.set("duration", String(Math.round(query.duration)));
  }

  const response = await fetch(`${process.env.REACT_APP_API_URL}lyrics/?${params.toString()}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error("Lyrics lookup failed");
  }
  return response.json();
};
