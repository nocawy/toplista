import React, { useRef } from "react";
import uploadFile from "../../api/uploadFile";

const ImportComponent: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLinkClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      uploadFile(event.target.files[0]);
    }
  };

  return (
    <div>
      <a className="nav-link" href="#" onClick={handleLinkClick}>
        import
      </a>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default ImportComponent;
