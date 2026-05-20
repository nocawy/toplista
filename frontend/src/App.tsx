import "./App.css";
import React, { useRef } from "react";
import ActionBar from "./components/ActionBar/ActionBar";
import SongList, { SongListHandle } from "./components/SongList";
import useSongs from "./hooks/useSongs";
import { AuthProvider } from "./contexts/AuthContext";
import { useRanking } from "./contexts/RankingContext";
import Footer from "./components/Footer";
import EmbeddedPlayerPanel from "./components/EmbeddedPlayer/EmbeddedPlayerPanel";
import { useAutoScrollToSong } from "./hooks/useAutoScrollToSong";
import { useMediaSession } from "./hooks/useMediaSession";
import { usePlaybackQueue } from "./hooks/usePlaybackQueue";

function App() {
  const { songs, setSongs } = useSongs();
  const { currentSlug } = useRanking();
  const songListRef = useRef<SongListHandle>(null);
  const {
    queueMode,
    queuedSongIds,
    currentDisplaySong,
    playbackPositionLabel,
    startRandomQueue,
    clearQueue,
    playSong,
    playNext,
    playPrevious,
    canGoNext,
    canGoPrevious,
  } = usePlaybackQueue(songs, currentSlug);

  useMediaSession({
    currentSong: currentDisplaySong,
    canGoNext,
    canGoPrevious,
    onNext: playNext,
    onPrevious: playPrevious,
  });
  useAutoScrollToSong(currentDisplaySong?.id);

  const focusPlayingSong = () => {
    if (currentDisplaySong) {
      songListRef.current?.scrollToSong(currentDisplaySong.id);
    }
  };

  return (
    <div className="App">
      <EmbeddedPlayerPanel
        currentSong={currentDisplaySong}
        showQueueCounter={queueMode === "random"}
        playbackPositionLabel={playbackPositionLabel}
        onEnded={playNext}
        onNext={playNext}
        onPrevious={playPrevious}
        onFocusPlayingSong={focusPlayingSong}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
      />
      <AuthProvider>
        <ActionBar
          songs={songs}
          setSongs={setSongs}
          queueMode={queueMode}
          onPlayRandom={startRandomQueue}
          onClearQueue={clearQueue}
        />
        <SongList
          ref={songListRef}
          songs={songs}
          setSongs={setSongs}
          queueMode={queueMode}
          queuedSongIds={queuedSongIds}
          currentSongId={currentDisplaySong?.id ?? null}
          onPlaySong={playSong}
        />
      </AuthProvider>
      <Footer />
    </div>
  );
}

export default App;
