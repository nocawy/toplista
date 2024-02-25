// Song.tsx

import React, { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./AddSongForm.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faSave,
  faTimes,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { fetchSongs, updateSong, deleteSong } from "../api/songService";
import { useAuth } from "../contexts/AuthContext";

export interface Song {
  id: number;
  s_yt_id: string;
  s_artist: string;
  s_title: string;
  s_album?: string; // optional
  s_released?: number; // optional
  s_discovered?: number; // optional
  s_comment?: string; // optional
  s_last_updated: string;
  s_created_on: string;
  r_rank: number;
}

interface SongProps {
  song: Song;
  index: number; // row number
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
}

const SongComponent: React.FC<SongProps> = ({ song, index, setSongs }) => {
  const { isLoggedIn } = useAuth();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: song.id,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedSong, setEditedSong] = useState<Song>(song);

  useEffect(() => {
    // Handle key down event to listen for ESC key press
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Using `key` instead of `keyCode`
        setIsEditing(false); // Logic to exit edit mode
      }
    };
    document.addEventListener("keydown", handleEscape);
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  const refreshSongList = async () => {
    // Re-fetch the updated list of songs from the backend to reflect any changes
    const updatedSongsList = await fetchSongs();
    // Use setSongs to update the SongList component with the newly fetched list
    setSongs(updatedSongsList);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditedSong((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    try {
      // Update the song on the backend via API call
      await updateSong(editedSong);
      console.log("Song saved successfully");
      // Refresh the song list on the frontend to reflect the update
      refreshSongList();
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save the song:", error);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.confirm("Czy na pewno chcesz usunąć tę piosenkę?")) {
        await deleteSong(song.id);
        refreshSongList();
      }
    } catch (error) {
      console.error("Failed to delete the song:", error);
    }
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {!isEditing ? (
        <>
          <td>
            <div className="drag-handle" {...attributes} {...listeners}>
              &equiv; {/* ≡ */}
            </div>
          </td>
          <td>{index}</td>
          <td>
            <a
              className="play-link"
              href={`https://www.youtube.com/watch?v=${song.s_yt_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              &#x23F5; {/* ⏵,  &#9654; &#x25B6; ▶ */}
            </a>
          </td>
          <td>{song.s_artist}</td>
          <td>{song.s_title}</td>
          <td>{song.s_album || "-"}</td>
          <td>{song.s_released || "-"}</td>
          <td>{song.s_discovered || "-"}</td>
          <td>{song.s_comment || "-"}</td>
          {isLoggedIn && (
            <td>
              <button onClick={() => setIsEditing(true)}>
                <FontAwesomeIcon icon={faEdit} /> {/* edit */}
              </button>
            </td>
          )}
        </>
      ) : (
        // Song edit form
        <td colSpan={10}>
          <form className="form-row">
            <div className="form-field short">
              <input
                name="s_yt_id"
                value={editedSong.s_yt_id}
                onChange={handleChange}
                placeholder="YouTube ID"
              />
            </div>
            <div className="form-field">
              <input
                name="s_artist"
                value={editedSong.s_artist}
                onChange={handleChange}
                placeholder="Artist"
              />
            </div>
            <div className="form-field">
              <input
                name="s_title"
                value={editedSong.s_title}
                onChange={handleChange}
                placeholder="Title"
              />
            </div>
            <div className="form-field">
              <input
                name="s_album"
                value={editedSong.s_album}
                onChange={handleChange}
                placeholder="Album"
              />
            </div>
            <div className="form-field short">
              <input
                name="s_released"
                value={editedSong.s_released}
                onChange={handleChange}
                placeholder="released"
              />
            </div>
            <div className="form-field short">
              <input
                name="s_discovered"
                value={editedSong.s_discovered}
                onChange={handleChange}
                placeholder="discovered"
              />
            </div>
            <div className="form-field long">
              <input
                name="s_comment"
                value={editedSong.s_comment}
                onChange={handleChange}
                placeholder="comment"
              />
            </div>
            <div className="form-field button">
              <button onClick={handleSave}>
                <FontAwesomeIcon icon={faSave} /> {/* save */}
              </button>
            </div>
            <div className="form-field button">
              <button onClick={handleDelete}>
                <FontAwesomeIcon icon={faTrashAlt} /> {/* delete */}
              </button>
            </div>
            <div className="form-field button">
              <button onClick={() => setIsEditing(false)}>
                <FontAwesomeIcon icon={faTimes} /> {/* discard */}
              </button>
            </div>
          </form>
        </td>
      )}
    </tr>
  );
};

export default SongComponent;
