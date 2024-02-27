// components/ActionBar/Import.tsx
import React, { useRef } from "react";
import uploadCSV from "../../api/uploadCSV";
import { Song } from "../Song";
import { fetchSongs } from "../../api/songService";

interface ImportComponentProps {
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
}

const ImportComponent: React.FC<ImportComponentProps> = ({ setSongs }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLinkClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files[0]) {
      await uploadCSV(event.target.files[0]);
      // Refresh the SongList after upload
      const updatedSongsList = await fetchSongs();
      setSongs(updatedSongsList);
    }
  };

  return (
    <div>
      <a className="nav-link" href="#" onClick={handleLinkClick}>
        csv import
      </a>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default ImportComponent;
