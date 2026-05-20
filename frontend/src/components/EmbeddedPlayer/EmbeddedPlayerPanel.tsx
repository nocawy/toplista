import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { Song } from "../Song";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";
import "./EmbeddedPlayerPanel.css";

interface EmbeddedPlayerPanelProps {
  currentSong: Song | null;
  playbackPositionLabel: string | null;
  onEnded: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onFocusPlayingSong: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const EmbeddedPlayerPanel: React.FC<EmbeddedPlayerPanelProps> = ({
  currentSong,
  playbackPositionLabel,
  onEnded,
  onNext,
  onPrevious,
  onFocusPlayingSong,
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
          <div
            className={`player-queue-position${playbackPositionLabel ? "" : " player-queue-position-placeholder"}`}
            aria-live="polite"
          >
            {playbackPositionLabel ?? "-"}
          </div>
          <button type="button" onClick={onPrevious} disabled={!canGoPrevious}>
            previous
          </button>
          <button type="button" onClick={onNext} disabled={!canGoNext}>
            next
          </button>
          <button
            type="button"
            className="player-focus-song"
            onClick={onFocusPlayingSong}
            title="Scroll to playing song"
            aria-label="Scroll to playing song in ranking"
          >
            <FontAwesomeIcon icon={faCrosshairs} />
          </button>
        </div>
        <EmbeddedYouTubePlayer videoId={currentSong.s_yt_id} onEnded={onEnded} />
      </div>
    </header>
  );
};

export default EmbeddedPlayerPanel;
