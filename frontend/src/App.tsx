import "./App.css";
import React, { useRef } from "react";
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
  const { songs, setSongs, songsSlug, isLoading, error, refreshSongs } = useSongs();
  const { currentSlug } = useRanking();
  const songListRef = useRef<SongListHandle>(null);
  const {
    queueMode,
    queuedSongIds,
    queueSlug,
    currentDisplaySong,
    playbackPositionLabel,
    startRandomQueue,
    clearQueue,
    playSong,
    playNext,
    playPrevious,
    canGoNext,
    canGoPrevious,
  } = usePlaybackQueue(songs, songsSlug);

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

  // The playing song can only be focused (and its queue highlighted in the
  // tabs) in the ranking the queue belongs to.
  const isQueueRankingVisible = currentSlug === queueSlug;
  const playingSlug = currentDisplaySong ? queueSlug : null;
  const isCurrentRankingLoaded = songsSlug === currentSlug;
  const visibleSongs = isCurrentRankingLoaded ? songs : [];

  return (
    <div className="App">
      <AuthProvider>
        <EmbeddedPlayerPanel
          currentSong={currentDisplaySong}
          songs={songs}
          setSongs={setSongs}
          queueMode={queueMode}
          playbackPositionLabel={playbackPositionLabel}
          onEnded={playNext}
          onNext={playNext}
          onPrevious={playPrevious}
          onFocusPlayingSong={focusPlayingSong}
          onPlayRandom={startRandomQueue}
          onClearQueue={clearQueue}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          canFocusPlayingSong={currentDisplaySong !== null && isQueueRankingVisible}
          playingSlug={playingSlug}
        />
        <SongList
          ref={songListRef}
          songs={visibleSongs}
          setSongs={setSongs}
          rankingSlug={currentSlug}
          refreshSongs={refreshSongs}
          isLoading={isLoading || !isCurrentRankingLoaded}
          error={error}
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
