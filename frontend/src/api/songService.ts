// api/songService.ts
import apiClient from "./apiClient";
import { Song } from "../components/Song";

export interface YouTubeSongSuggestion {
  s_yt_id: string;
  s_artist: string;
  s_title: string;
  s_album: string | null;
  s_released: number | null;
  s_discovered: string;
  source_title: string;
  source_channel: string;
  thumbnail_url: string;
}

export const fetchSongs = async (slug: string, signal?: AbortSignal): Promise<Song[]> => {
  const response = await fetch(`${process.env.REACT_APP_API_URL}songs/?list=${encodeURIComponent(slug)}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
};

export const lookupSongByYtId = async (ytId: string): Promise<Song | null> => {
  const response = await fetch(`${process.env.REACT_APP_API_URL}songs/lookup/?yt_id=${encodeURIComponent(ytId)}`);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Song lookup failed");
  }

  return response.json();
};

export const fetchYouTubeSongSuggestions = async (ytId: string): Promise<YouTubeSongSuggestion | null> => {
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}songs/youtube-metadata/?yt_id=${encodeURIComponent(ytId)}`
  );

  if (response.status === 404 || response.status === 502) return null;
  if (!response.ok) {
    throw new Error("YouTube metadata lookup failed");
  }

  return response.json();
};

interface SongUpdate {
  songId: number;
  newRank: number;
}

export const updateSongRank = async (songUpdate: SongUpdate, slug: string) => {
  try {
    const response = await apiClient.patch(`update/rank/?list=${encodeURIComponent(slug)}`, songUpdate);
    console.log("Successfully updated the song: ", response.data);
  } catch (error) {
    console.error("Error updateSongRank:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const addNewSong = async (newSong: Omit<Song, "id">, slug: string): Promise<void> => {
  try {
    const response = await apiClient.post(`songs/add/?list=${encodeURIComponent(slug)}`, newSong);
    console.log("Successfully added new song:", response.data);
  } catch (error) {
    console.error("Error addNewSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const updateSong = async (song: Song): Promise<void> => {
  try {
    const response = await apiClient.patch(`songs/update/${song.id}`, song);
    console.log("Song updated successfully:", response.data);
  } catch (error) {
    console.error("Error updateSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const deleteSong = async (songId: number, slug: string): Promise<void> => {
  try {
    const response = await apiClient.delete(`songs/delete/${songId}/?list=${encodeURIComponent(slug)}`);
    console.log("Song deleted successfully:", response.data);
  } catch (error) {
    console.error("Error deleteSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};
