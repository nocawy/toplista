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
  updateSong,
  deleteSong,
  updateSongRank,
} from "../api/songService";
import { useAuth } from "../contexts/AuthContext";
import { parseSongFieldInput } from "../utils/parsers";

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
  rankingSlug: string;
  refreshSongs: (slug?: string) => Promise<Song[] | null>;
  isQueued?: boolean;
  isCurrentlyPlaying?: boolean;
  onPlaySong: (song: Song) => void;
}

const SongComponent: React.FC<SongProps> = ({
  song,
  index,
  songsCount,
  rankingSlug,
  refreshSongs,
  isQueued = false,
  isCurrentlyPlaying = false,
  onPlaySong,
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
    let cancelled = false;
    setIsUnavailable(false);
    img.src = `https://img.youtube.com/vi/${song.s_yt_id}/mqdefault.jpg`;

    img.onload = () => {
      if (!cancelled && img.naturalWidth === 120 && img.naturalHeight === 90) {
        setIsUnavailable(true); // placeholder thumbnail = video probably unavailable
      }
    };

    img.onerror = () => {
      if (!cancelled) setIsUnavailable(true); // could not load thumbnail at all
    };

    return () => {
      cancelled = true;
    };
  }, [song.s_yt_id]);

  useEffect(() => {
    if (!isEditing) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditedSong(song);
        setErrors({});
        setIsEditing(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isEditing, song]);

  const refreshSongList = async () => {
    const updatedSongsList = await refreshSongs(rankingSlug);
    if (!updatedSongsList) {
      throw new Error("Could not refresh ranking");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.target.name === "r_rank") {
      const parsedRank = parseInt(e.target.value, 10);
      if (!Number.isNaN(parsedRank)) setrankInput(parsedRank);
      return;
    }
    const { name, value } = e.target;
    const parsedValue = parseSongFieldInput(name, value);
    setEditedSong((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const handleRankKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsEditingRank(false);
      setrankInput(song.r_rank);
    }
    if (e.key === "Enter") {
      try {
        await updateSongRank({ songId: song.id, newRank: rankInput }, rankingSlug);
        setIsEditingRank(false);
        await refreshSongList();
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
      await refreshSongList();
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

  const handleDelete = async () => {
    try {
      if (window.confirm("Czy na pewno chcesz usunąć tę piosenkę?")) {
        await deleteSong(song.id, rankingSlug);
        await refreshSongList();
      }
    } catch (error) {
      console.error("Failed to delete the song:", error);
    }
  };

  const startEditing = () => {
    setEditedSong(song);
    setErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedSong(song);
    setErrors({});
    setIsEditing(false);
  };

  const rowClassName = [
    isQueued ? "random-selected" : "",
    isCurrentlyPlaying ? "currently-playing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr
      id={`song-row-${song.id}`}
      ref={setNodeRef}
      style={style}
      className={rowClassName}
    >
      {!isEditing || !isLoggedIn ? (
        <>
          <td>
            <div className="drag-handle" {...attributes} {...listeners}>
              &equiv; {/* ≡ */}
            </div>
          </td>
          <td
            className={isLoggedIn ? "rank-cell rank-cell-editable" : "rank-cell"}
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
            <button
              type="button"
              className="play-link"
              onClick={() => onPlaySong(song)}
              aria-label={`Play ${song.s_title}`}
            >
              &#x23F5;{/* ⏵ */}
            </button>
          </td>
          <td className="youtube-link-column">
            <a
              className={`youtube-link${isUnavailable ? " unavailable" : ""}`}
              href={`https://www.youtube.com/watch?v=${song.s_yt_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={isUnavailable ? "Video may be unavailable — open on YouTube to verify" : "Open on YouTube"}
              aria-label={
                isUnavailable
                  ? `Video may be unavailable: ${song.s_title}`
                  : `Open ${song.s_title} on YouTube`
              }
            >
              {isUnavailable ? "-x-" : "YT"}
            </a>
          </td>
          <td>{song.s_artist || "-"}</td>
          <td>{song.s_title}</td>
          <td>{song.s_album || "-"}</td>
          <td>{song.s_released || "-"}</td>
          <td>{song.s_discovered || "-"}</td>
          <td>{song.s_comment || "-"}</td>
          <td className="song-actions-column">
            {isLoggedIn ? (
              <div className="form-field button">
                <button
                  type="button"
                  className="icon-button"
                  onClick={startEditing}
                  aria-label={`Edit ${song.s_title}`}
                >
                  <FontAwesomeIcon icon={faEdit} /> {/* edit */}
                </button>
              </div>
            ) : (
              <span className="song-action-placeholder" aria-hidden="true" />
            )}
          </td>
        </>
      ) : (
        // Song edit form
        <td colSpan={11} className="song-edit-cell">
          <form className="form-row song-edit-row" autoComplete="off" onSubmit={handleSave}>
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
              <button type="submit" aria-label={`Save ${song.s_title}`}>
                <FontAwesomeIcon icon={faSave} /> {/* save */}
              </button>
            </div>
            <div className="form-field button">
              <button type="button" onClick={handleDelete} aria-label={`Delete ${song.s_title}`}>
                <FontAwesomeIcon icon={faTrashAlt} /> {/* delete */}
              </button>
            </div>
            <div className="form-field button">
              <button type="button" onClick={cancelEditing} aria-label={`Discard changes to ${song.s_title}`}>
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
