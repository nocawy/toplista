// api/songService.ts
import apiClient from "./apiClient";
import { Song } from "../components/Song";

export const fetchSongs = async (): Promise<Song[]> => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}songs/`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const songs: Song[] = await response.json();
    return songs;
  } catch (error) {
    console.error("Error getting songs:", error);
    throw error;
  }
};

interface SongUpdate {
  songId: number;
  newRank: number;
}

export const updateSongRank = async (songUpdate: SongUpdate) => {
  try {
    const response = await apiClient.patch("update/rank/", songUpdate);
    console.log("Successfully updated the song: ", response.data);
  } catch (error) {
    console.error("Error updateSongRank:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const addNewSong = async (newSong: Omit<Song, "id">): Promise<void> => {
  try {
    const response = await apiClient.post("songs/add/", newSong);
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

export const deleteSong = async (songId: number): Promise<void> => {
  try {
    const response = await apiClient.delete(`songs/delete/${songId}`);
    console.log("Song deleted successfully:", response.data);
  } catch (error) {
    console.error("Error deleteSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};
