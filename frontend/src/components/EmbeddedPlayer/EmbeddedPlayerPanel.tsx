import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { Song } from "../Song";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";
import PlayRandom from "../ActionBar/PlayRandom";
import ImportComponent from "../ActionBar/Import";
import ExportComponent from "../ActionBar/Export";
import LoginForm from "../ActionBar/LoginForm";
import RankingSwitcher from "../ActionBar/RankingSwitcher";
import { useAuth } from "../../contexts/AuthContext";
import type { QueueMode } from "../../hooks/usePlaybackQueue";
import "../ActionBar/ActionBar.css";
import "./EmbeddedPlayerPanel.css";

interface EmbeddedPlayerPanelProps {
  currentSong: Song | null;
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  queueMode: QueueMode;
  playbackPositionLabel: string | null;
  onEnded: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onFocusPlayingSong: () => void;
  onPlayRandom: (selectedSongs: Song[]) => void;
  onClearQueue: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const EmbeddedPlayerPanel: React.FC<EmbeddedPlayerPanelProps> = ({
  currentSong,
  songs,
  setSongs,
  queueMode,
  playbackPositionLabel,
  onEnded,
  onNext,
  onPrevious,
  onFocusPlayingSong,
  onPlayRandom,
  onClearQueue,
  canGoNext,
  canGoPrevious,
}) => {
  const { isLoggedIn } = useAuth();
  const showQueueCounter = queueMode === "random";

  return (
    <header
      className={`App-header player-header ${
        currentSong ? "player-header-active" : "player-header-idle"
      }`}
    >
      <div className="player-side">
        <h1>Osobisty Top Wszech Czasów</h1>
        <div className="player-side-utils">
          <LoginForm />
          {isLoggedIn && <ImportComponent setSongs={setSongs} />}
          <ExportComponent songs={songs} />
        </div>
        <RankingSwitcher />
      </div>
      {currentSong && (
        <div className="player-lyrics-placeholder">
          <div className="player-current-song">
            {currentSong.s_artist && `${currentSong.s_artist} - `}
            {currentSong.s_title}
          </div>
          <div className="player-lyrics-note">lyrics area</div>
        </div>
      )}
      <div className="player-queue-controls" aria-label="Playback controls">
        <div
          className={`player-queue-position${
            showQueueCounter
              ? playbackPositionLabel
                ? ""
                : " player-queue-position-placeholder"
              : " player-queue-position-hidden"
          }`}
          aria-live="polite"
        >
          {showQueueCounter ? (playbackPositionLabel ?? "-") : "-"}
        </div>
        <button
          type="button"
          className="player-nav-button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          previous
        </button>
        <button
          type="button"
          className="player-nav-button"
          onClick={onNext}
          disabled={!canGoNext}
        >
          next
        </button>
        <button
          type="button"
          className="player-nav-button player-focus-song"
          onClick={onFocusPlayingSong}
          disabled={!currentSong}
          title="Scroll to playing song"
          aria-label="Scroll to playing song in ranking"
        >
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
        <PlayRandom
          songs={songs}
          queueMode={queueMode}
          onPlayRandom={onPlayRandom}
          onClearQueue={onClearQueue}
        />
      </div>
      {currentSong && (
        <div className="player-video">
          <EmbeddedYouTubePlayer videoId={currentSong.s_yt_id} onEnded={onEnded} />
        </div>
      )}
    </header>
  );
};

export default EmbeddedPlayerPanel;
