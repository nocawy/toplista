import React from "react";
import { Song } from "../Song";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";
import "./EmbeddedPlayerPanel.css";

interface EmbeddedPlayerPanelProps {
  currentSong: Song | null;
  onEnded: () => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const EmbeddedPlayerPanel: React.FC<EmbeddedPlayerPanelProps> = ({
  currentSong,
  onEnded,
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
}) => {
  if (!currentSong) {
    return (
      <header className="App-header player-header player-header-idle">
        <h1>Osobisty Top Wszech Czasów</h1>
      </header>
    );
  }

  return (
    <header className="App-header player-header player-header-active">
      <div className="player-title">
        <h1>Osobisty Top Wszech Czasów</h1>
      </div>
      <div className="player-lyrics-placeholder">
        <div className="player-current-song">
          {currentSong.s_artist && `${currentSong.s_artist} - `}
          {currentSong.s_title}
        </div>
        <div className="player-lyrics-note">lyrics area</div>
      </div>
      <div className="player-frame-panel">
        <div className="player-queue-controls" aria-label="Playback queue controls">
          <button type="button" onClick={onPrevious} disabled={!canGoPrevious}>
            previous
          </button>
          <button type="button" onClick={onNext} disabled={!canGoNext}>
            next
          </button>
        </div>
        <EmbeddedYouTubePlayer videoId={currentSong.s_yt_id} onEnded={onEnded} />
      </div>
    </header>
  );
};

export default EmbeddedPlayerPanel;
