// api/songService.ts

import { Song } from "../components/Song";

async function handleErrorResponse(response: Response): Promise<void> {
  if (!response.ok) {
    // Attempt to read the error message from the response body
    const errorBody = await response.json();

    if (Object.keys(errorBody).length > 0) {
      // Collect all error messages into a single string
      let allErrors = "";
      Object.keys(errorBody).forEach((key) => {
        const errorsForField = errorBody[key].join(", ");
        allErrors += `${key}: ${errorsForField}; `;
      });

      // Throw the collected errors
      throw new Error(allErrors);
    } else {
      // Default error message if the errorBody is empty
      throw new Error(
        "Server error occurred, but no error message was provided."
      );
    }
  }
}

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

    handleErrorResponse(response);

    // Optional: Process response data
    const data = await response.json();
    console.log("Successfully added new song:", data);
  } catch (error) {
    console.error("Error addNewSong:", error);
    throw error; // Re-throwing the error to be handled by the caller
  }
};
