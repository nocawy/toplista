// Song.tsx

import React, { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./AddSongForm.css";
import "./Song.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faSave,
  faTimes,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchSongs,
  updateSong,
  deleteSong,
  updateSongRank,
} from "../api/songService";
import { useAuth } from "../contexts/AuthContext";

export interface Song {
  id: number;
  s_yt_id: string;
  s_artist: string | null;
  s_title: string;
  s_album: string | null;
  s_released: number | null;
  s_discovered: string | null;
  s_comment: string | null;
  s_last_updated: string;
  s_created_on: string;
  r_rank: number;
}

interface SongProps {
  song: Song;
  index: number; // row number
  songsCount: number;
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  isRandomSelected?: boolean;
}

const SongComponent: React.FC<SongProps> = ({
  song,
  index,
  songsCount,
  setSongs,
  isRandomSelected = false,
}) => {
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
  const [isEditingRank, setIsEditingRank] = useState<boolean>(false);
  const [rankInput, setrankInput] = useState<number>(song.r_rank);
  const [editedSong, setEditedSong] = useState<Song>(song);
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);

  useEffect(() => {
    setrankInput(song.r_rank);
  }, [song.r_rank]);

  useEffect(() => {
    const img = new Image();
    img.src = `https://img.youtube.com/vi/${song.s_yt_id}/mqdefault.jpg`;

    img.onload = () => {
      if (img.naturalWidth === 120 && img.naturalHeight === 90) {
        setIsUnavailable(true); // placeholder thumbnail = video probably unavailable
      }
    };

    img.onerror = () => {
      setIsUnavailable(true); // could not load thumbnail at all
    };
  }, [song.s_yt_id]);

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
    if (e.target.name === "r_rank") {
      return setrankInput(parseInt(e.target.value, 10));
    }
    const { name, value } = e.target;
    setEditedSong((prev) => ({
      ...prev,
      [name]:
        name === "s_released"
          ? value === ""
            ? null
            : parseInt(value, 10)
          : value,
    }));
  };

  const handleRankKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsEditingRank(false);
      setrankInput(song.r_rank);
    }
    if (e.key === "Enter") {
      try {
        await updateSongRank({ songId: song.id, newRank: rankInput });
        setIsEditingRank(false);
        refreshSongList();
      } catch (err) {
        console.error("Couldn't update rank:", err);
      }
    }
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
      // Clear errors after successfully adding a new song
      setErrors({});
    } catch (error) {
      // console.error("Failed handleSave to save the song:", error);
      if (isAxiosError(error) && error.response) {
        setErrors(error.response.data);
      } else {
        // console.error("Unexpected error:", error);
        setErrors({ general: ["An unexpected error occurred."] });
      }
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
    <tr
      ref={setNodeRef}
      style={style}
      className={isRandomSelected ? "random-selected" : ""}
    >
      {!isEditing || !isLoggedIn ? (
        <>
          <td>
            <div className="drag-handle" {...attributes} {...listeners}>
              &equiv; {/* ≡ */}
            </div>
          </td>
          <td
            onClick={() => {
              if (!isLoggedIn) return;
              setrankInput(song.r_rank);
              setIsEditingRank(true);
            }}
            style={{ cursor: isLoggedIn ? "pointer" : "default" }}
          >
            {isEditingRank ? (
              <input
                name="r_rank"
                type="number"
                min={1}
                max={songsCount}
                value={rankInput}
                onChange={(e) => setrankInput(parseInt(e.target.value, 10))}
                onKeyDown={handleRankKey}
                onBlur={() => setIsEditingRank(false)}
                autoFocus
                style={{
                  width: "1.65em",
                  textAlign: "center",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                }}
                className="no-spinner"
              />
            ) : (
              index
            )}
          </td>
          <td>
            <a
              className={`play-link ${isUnavailable ? "unavailable" : ""}`}
              href={`https://www.youtube.com/watch?v=${song.s_yt_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              &#x23F5;{/* ⏵,  &#9654; &#x25B6; ▶ */}
              {isUnavailable && "x"}
            </a>
          </td>
          <td>{song.s_artist || "-"}</td>
          <td>{song.s_title}</td>
          <td>{song.s_album || "-"}</td>
          <td>{song.s_released || "-"}</td>
          <td>{song.s_discovered || "-"}</td>
          <td>{song.s_comment || "-"}</td>
          {isLoggedIn && (
            <td>
              <div className="form-field button">
                <button onClick={() => setIsEditing(true)}>
                  <FontAwesomeIcon icon={faEdit} /> {/* edit */}
                </button>
              </div>
            </td>
          )}
        </>
      ) : (
        // Song edit form
        <td colSpan={10}>
          <form className="form-row" autoComplete="off">
            <div className="form-field yt_id">
              <input
                name="s_yt_id"
                value={editedSong.s_yt_id}
                onChange={handleChange}
                placeholder="YouTube ID"
              />
              {errors.s_yt_id && <div className="error">{errors.s_yt_id}</div>}
            </div>
            <div className="form-field">
              <input
                name="s_artist"
                value={editedSong.s_artist ?? ""}
                onChange={handleChange}
                placeholder="Artist"
              />
              {errors.s_artist && (
                <div className="error">{errors.s_artist}</div>
              )}
            </div>
            <div className="form-field">
              <input
                name="s_title"
                value={editedSong.s_title}
                onChange={handleChange}
                placeholder="Title"
              />
              {errors.s_title && <div className="error">{errors.s_title}</div>}
            </div>
            <div className="form-field">
              <input
                name="s_album"
                value={editedSong.s_album ?? ""}
                onChange={handleChange}
                placeholder="Album"
              />
              {errors.s_album && <div className="error">{errors.s_album}</div>}
            </div>
            <div className="form-field years">
              <input
                name="s_released"
                type="number"
                value={editedSong.s_released ?? ""}
                onChange={handleChange}
                placeholder="released"
              />
              {errors.s_released && (
                <div className="error">{errors.s_released}</div>
              )}
            </div>
            <div className="form-field years">
              <input
                name="s_discovered"
                value={editedSong.s_discovered ?? ""}
                onChange={handleChange}
                placeholder="discovered"
              />
              {errors.s_discovered && (
                <div className="error">{errors.s_discovered}</div>
              )}
            </div>
            <div className="form-field long">
              <input
                name="s_comment"
                value={editedSong.s_comment ?? ""}
                onChange={handleChange}
                placeholder="comment"
              />
              {errors.s_comment && (
                <div className="error">{errors.s_comment}</div>
              )}
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
