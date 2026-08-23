import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrosshairs, faPlay } from "@fortawesome/free-solid-svg-icons";
import { Song } from "../Song";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";
import LyricsPanel from "./LyricsPanel";
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
  canFocusPlayingSong: boolean;
  playingSlug: string | null;
}

interface PlaybackState {
  videoId: string | null;
  currentTime: number;
  duration: number | null;
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
  canFocusPlayingSong,
  playingSlug,
}) => {
  const { isLoggedIn } = useAuth();
  const showQueueCounter = queueMode === "random";
  const currentVideoId = currentSong?.s_yt_id ?? null;
  const [playback, setPlayback] = useState<PlaybackState>({
    videoId: null,
    currentTime: 0,
    duration: null,
  });
  const currentPlayback =
    playback.videoId === currentVideoId
      ? playback
      : { videoId: currentVideoId, currentTime: 0, duration: null };

  return (
    <header className="App-header player-header">
      <div className="player-side">
        <h1>Osobisty Top Wszech Czasów</h1>
        <div className="player-side-utils">
          <LoginForm />
          {isLoggedIn && <ImportComponent setSongs={setSongs} />}
          <ExportComponent songs={songs} />
        </div>
        <RankingSwitcher playingSlug={playingSlug} />
      </div>
      <LyricsPanel
        song={currentSong}
        currentTimeSeconds={currentPlayback.currentTime}
        durationSeconds={currentPlayback.duration}
      />
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
          disabled={!canFocusPlayingSong}
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
      <div className="player-video">
        {currentSong ? (
          <EmbeddedYouTubePlayer
            key={currentSong.s_yt_id}
            videoId={currentSong.s_yt_id}
            onEnded={onEnded}
            onPlaybackProgress={({ currentTime: time, duration: videoDuration }) => {
              setPlayback({
                videoId: currentSong.s_yt_id,
                currentTime: time,
                duration: videoDuration > 0 ? videoDuration : null,
              });
            }}
          />
        ) : (
          <div className="player-video-placeholder" aria-hidden="true">
            <FontAwesomeIcon icon={faPlay} />
          </div>
        )}
      </div>
    </header>
  );
};

export default EmbeddedPlayerPanel;
