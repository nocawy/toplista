// api/songService.ts

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
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}update/rank/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // 'Authorization': 'Token YourAuthorizationToken', // TODO
        },
        body: JSON.stringify(songUpdate),
      }
    );

    if (!response.ok) {
      throw new Error("Problem with song update");
    }

    const data = await response.json(); // Optionally, if backend returns something
    console.log("Successfully updated the song", data);
  } catch (error) {
    console.error("Error updating song:", error);
  }
};

export const addNewSong = async (newSong: Omit<Song, "id">): Promise<void> => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}songs/add/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Include any additional headers your API requires
      },
      body: JSON.stringify(newSong),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw errorBody;
    }

    // Optional: Process response data
    const data = await response.json();
    console.log("Successfully added new song:", data);
  } catch (error) {
    console.error("Error addNewSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const updateSong = async (song: Song): Promise<void> => {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}songs/update/${song.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // 'Authorization': 'Token YourAuthorizationToken',
        },
        body: JSON.stringify(song),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      throw errorBody;
    }

    console.log("Song updated successfully");
  } catch (error) {
    console.error("Error updating song:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};

export const deleteSong = async (songId: number): Promise<void> => {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}songs/delete/${songId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          // 'Authorization': `Bearer ${YourAuthToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      throw errorBody;
    }

    console.log("Song deleted successfully");
  } catch (error) {
    console.error("Error deleting song:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};
