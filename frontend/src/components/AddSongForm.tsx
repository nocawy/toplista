import React, { useState } from "react";
import { Song } from "./Song";
import "./AddSongForm.css";
import { fetchSongs } from "../api/songService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

interface AddSongFormProps {
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  addNewSong: (newSong: Song) => void;
  nextRank: number;
}

const AddSongForm: React.FC<AddSongFormProps> = ({
  setSongs,
  addNewSong,
  nextRank,
}) => {
  const [newSong, setNewSong] = useState<Song>({
    id: Date.now(), // temporary ID, backend will provide a proper one
    s_yt_id: "",
    s_artist: "",
    s_title: "",
    s_album: "",
    s_released: undefined,
    s_discovered: undefined,
    s_comment: "",
    s_last_updated: new Date().toISOString(),
    s_created_on: new Date().toISOString(),
    r_rank: nextRank,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewSong((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Add the new song to the database
      await addNewSong(newSong);

      // Re-fetch the list of songs to include the newly added one
      const updatedSongsList = await fetchSongs();

      // Update the list of songs in the SongList component using setSongs
      setSongs(updatedSongsList);

      // Reset the form state after adding a song, preparing the rank for the next new song
      setNewSong((prev) => ({
        ...prev,
        s_yt_id: "",
        s_artist: "",
        s_title: "",
        s_album: "",
        s_released: undefined,
        s_discovered: undefined,
        s_comment: "",
        // Assuming r_rank is sequential and there are no gaps
        r_rank: updatedSongsList.length + 1,
      }));
    } catch (error) {
      console.error("Error on submit new song:", error);
      // Optionally: handle the error in the UI
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-row">
      <div className="form-field short">
        <input
          name="s_yt_id"
          value={newSong.s_yt_id}
          onChange={handleChange}
          placeholder="YouTube ID"
        />
      </div>
      <div className="form-field">
        <input
          name="s_artist"
          value={newSong.s_artist}
          onChange={handleChange}
          placeholder="Artist"
        />
      </div>
      <div className="form-field">
        <input
          name="s_title"
          value={newSong.s_title}
          onChange={handleChange}
          placeholder="Title"
        />
      </div>
      <div className="form-field">
        <input
          name="s_album"
          value={newSong.s_album}
          onChange={handleChange}
          placeholder="Album"
        />
      </div>
      <div className="form-field short">
        <input
          name="s_released"
          value={newSong.s_released}
          onChange={handleChange}
          placeholder="released"
        />
      </div>
      <div className="form-field short">
        <input
          name="s_discovered"
          value={newSong.s_discovered}
          onChange={handleChange}
          placeholder="discovered"
        />
      </div>
      <div className="form-field long">
        <input
          name="s_comment"
          value={newSong.s_comment}
          onChange={handleChange}
          placeholder="comment"
        />
      </div>
      <div className="form-field button">
        <button type="submit">
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
    </form>
  );
};

export default AddSongForm;
