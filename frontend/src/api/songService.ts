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
