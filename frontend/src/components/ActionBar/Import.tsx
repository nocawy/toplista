import React, { useRef } from "react";
import uploadCSV from "../../api/uploadCSV";

const ImportComponent: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLinkClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      uploadCSV(event.target.files[0]);
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
