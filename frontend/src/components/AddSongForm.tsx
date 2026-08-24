import React, { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Song } from "./Song";
import "./AddSongForm.css";
import {
  fetchYouTubeSongSuggestions,
  lookupSongByYtId,
  YouTubeSongSuggestion,
} from "../api/songService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { parseSongFieldInput } from "../utils/parsers";

type AutofillStatus = "" | "looking-up" | "filled-db" | "filled-youtube" | "not-found" | "error";
type AutofillField = "s_artist" | "s_title" | "s_album" | "s_released" | "s_discovered" | "s_comment";

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const AUTOFILL_FIELDS: AutofillField[] = [
  "s_artist",
  "s_title",
  "s_album",
  "s_released",
  "s_discovered",
  "s_comment",
];

const isEmptyAutofillValue = (value: Song[AutofillField] | undefined): boolean => {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.trim() === "";
};

interface AddSongFormProps {
  addNewSong: (newSong: Song) => Promise<void>;
  rankingSlug: string;
  refreshSongs: (slug?: string) => Promise<Song[] | null>;
  nextRank: number;
}

const AddSongForm: React.FC<AddSongFormProps> = ({
  addNewSong,
  rankingSlug,
  refreshSongs,
  nextRank,
}) => {
  const [newSong, setNewSong] = useState<Song>({
    id: Date.now(), // temporary ID, backend will provide a proper one
    s_yt_id: "",
    s_artist: "",
    s_title: "",
    s_album: "",
    s_released: null,
    s_discovered: "",
    s_comment: "",
    s_last_updated: new Date().toISOString(),
    s_created_on: new Date().toISOString(),
    r_rank: nextRank,
  });

  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});
  const [autofillStatus, setAutofillStatus] = useState<AutofillStatus>("");
  const touchedFields = useRef<Set<string>>(new Set());
  const lookupSequence = useRef<number>(0);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const parsedValue = parseSongFieldInput(name, value);

    if (name === "s_yt_id") {
      lookupSequence.current += 1;
      setAutofillStatus("");
    }

    if (AUTOFILL_FIELDS.includes(name as AutofillField) && isEmptyAutofillValue(parsedValue as Song[AutofillField])) {
      touchedFields.current.delete(name);
    } else {
      touchedFields.current.add(name);
    }

    setNewSong((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const mergeAutofillFields = (fields: Partial<Song>) => {
    setNewSong((prev) => {
      const next = { ...prev };

      AUTOFILL_FIELDS.forEach((field) => {
        if (fields[field] === undefined) return;
        const hasManualValue = touchedFields.current.has(field) && !isEmptyAutofillValue(prev[field]);
        if (hasManualValue) return;
        next[field] = fields[field] as never;
      });

      return next;
    });
  };

  const mergeSuggestionFields = (suggestion: YouTubeSongSuggestion) => {
    mergeAutofillFields({
      s_artist: suggestion.s_artist,
      s_title: suggestion.s_title,
      s_album: suggestion.s_album,
      s_released: suggestion.s_released,
      s_discovered: suggestion.s_discovered,
    });
  };

  const handleYouTubeIdBlur = async () => {
    const ytId = newSong.s_yt_id;
    if (!YOUTUBE_ID_RE.test(ytId)) {
      setAutofillStatus("");
      return;
    }

    const sequence = lookupSequence.current + 1;
    lookupSequence.current = sequence;
    setAutofillStatus("looking-up");

    try {
      const existingSong = await lookupSongByYtId(ytId);
      if (lookupSequence.current !== sequence) return;

      if (existingSong) {
        mergeAutofillFields(existingSong);
        setAutofillStatus("filled-db");
        return;
      }

      const suggestion = await fetchYouTubeSongSuggestions(ytId);
      if (lookupSequence.current !== sequence) return;

      if (suggestion) {
        mergeSuggestionFields(suggestion);
        setAutofillStatus("filled-youtube");
        return;
      }

      setAutofillStatus("not-found");
    } catch (error) {
      if (lookupSequence.current !== sequence) return;
      console.error("Autofill lookup error:", error);
      setAutofillStatus("error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Add the new song to the database
      await addNewSong(newSong);

      // Re-fetch the list of songs to include the newly added one
      const updatedSongsList = await refreshSongs(rankingSlug);
      if (!updatedSongsList) {
        throw new Error("Could not refresh ranking");
      }

      // Clear errors after successfully adding a new song
      setErrors({});

      // Reset the form state after adding a song, preparing the rank for the next new song
      setNewSong((prev) => ({
        ...prev,
        s_yt_id: "",
        s_artist: "",
        s_title: "",
        s_album: "",
        s_released: null,
        s_discovered: "",
        s_comment: "",
        // Assuming r_rank is sequential and there are no gaps
        r_rank: updatedSongsList.length + 1,
      }));
      touchedFields.current.clear();
      setAutofillStatus("");
    } catch (error) {
      // console.error("Error handleSubmit new song:", error);
      if (isAxiosError(error) && error.response) {
        setErrors(error.response.data);
      } else {
        // console.error("Unexpected error:", error);
        setErrors({ general: ["An unexpected error occurred."] });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-row" autoComplete="off">
      <div className="form-field yt_id">
        <input
          name="s_yt_id"
          value={newSong.s_yt_id}
          onChange={handleChange}
          onBlur={handleYouTubeIdBlur}
          placeholder="YouTube ID"
        />
        {errors.s_yt_id && <div className="error">{errors.s_yt_id}</div>}
        {autofillStatus === "looking-up" && <div className="autofill-status">looking up...</div>}
        {autofillStatus === "filled-db" && <div className="autofill-status">filled from database</div>}
        {autofillStatus === "filled-youtube" && <div className="autofill-status">suggested from YouTube title</div>}
        {autofillStatus === "not-found" && <div className="autofill-status">no metadata found</div>}
        {autofillStatus === "error" && <div className="autofill-status error">metadata lookup failed</div>}
      </div>
      <div className="form-field">
        <input
          name="s_artist"
          value={newSong.s_artist ?? ""}
          onChange={handleChange}
          placeholder="Artist"
        />
        {errors.s_artist && <div className="error">{errors.s_artist}</div>}
      </div>
      <div className="form-field">
        <input
          name="s_title"
          value={newSong.s_title}
          onChange={handleChange}
          placeholder="Title"
        />
        {errors.s_title && <div className="error">{errors.s_title}</div>}
      </div>
      <div className="form-field">
        <input
          name="s_album"
          value={newSong.s_album ?? ""}
          onChange={handleChange}
          placeholder="Album"
        />
        {errors.s_album && <div className="error">{errors.s_album}</div>}
      </div>
      <div className="form-field years">
        <input
          name="s_released"
          type="number"
          value={newSong.s_released ?? ""}
          onChange={handleChange}
          placeholder="released"
        />
        {errors.s_released && <div className="error">{errors.s_released}</div>}
      </div>
      <div className="form-field years">
        <input
          name="s_discovered"
          value={newSong.s_discovered ?? ""}
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
          value={newSong.s_comment ?? ""}
          onChange={handleChange}
          placeholder="comment"
        />
        {errors.s_comment && <div className="error">{errors.s_comment}</div>}
      </div>
      <div className="form-field add-button">
        <button type="submit">
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
    </form>
  );
};

export default AddSongForm;
