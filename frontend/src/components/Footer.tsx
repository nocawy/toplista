import React from "react";
import "./Footer.css";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="footer">
      © {currentYear}
      {" - "}
      <a href="https://github.com/nocawy/toplista" target="_blank" rel="noopener noreferrer">
        https://github.com/nocawy/toplista
      </a>
    </div>
  );
};

export default Footer;
