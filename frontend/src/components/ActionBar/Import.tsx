// components/ActionBar/Import.tsx
import React, { useRef, useState } from "react";
import uploadCSV from "../../api/uploadCSV";
import { Song } from "../Song";
import { useRanking } from "../../contexts/RankingContext";

interface ImportComponentProps {
  refreshSongs: () => Promise<Song[] | null>;
}

const ImportComponent: React.FC<ImportComponentProps> = ({ refreshSongs }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentSlug } = useRanking();

  const handleLinkClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError(null);
    try {
      await uploadCSV(file, currentSlug);
      await refreshSongs();
    } catch (uploadError) {
      console.error("There was an error during the file upload:", uploadError);
      setError("CSV import failed");
    } finally {
      input.value = "";
    }
  };

  return (
    <div>
      <button type="button" className="nav-link" onClick={handleLinkClick}>
        csv import
      </button>
      {error && <div className="error">{error}</div>}
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
