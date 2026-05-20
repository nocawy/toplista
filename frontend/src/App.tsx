import "./App.css";
import React, { useState } from "react";
import ActionBar from "./components/ActionBar/ActionBar";
import SongList from "./components/SongList";
import { Song } from "./components/Song";
import useSongs from "./hooks/useSongs";
import { AuthProvider } from "./contexts/AuthContext";
import Footer from "./components/Footer";
import EmbeddedPlayerPanel from "./components/EmbeddedPlayer/EmbeddedPlayerPanel";

function App() {
  const { songs, setSongs } = useSongs();
  const [queuedSongIds, setQueuedSongIds] = useState<number[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const queue = songs.filter((song) => queuedSongIds.includes(song.id));
  const currentDisplaySong = currentSong ? songs.find((song) => song.id === currentSong.id) ?? currentSong : null;
  const currentQueueIndex = currentDisplaySong ? queue.findIndex((song) => song.id === currentDisplaySong.id) : -1;

  const startQueue = (nextQueue: Song[]) => {
    setQueuedSongIds(nextQueue.map((song) => song.id));
    setCurrentSong(nextQueue[0] ?? null);
  };

  const stopPlayback = () => {
    setCurrentSong(null);
  };

  const findSongIndex = (song: Song | null) => {
    if (!song) return -1;
    return songs.findIndex((candidate) => candidate.id === song.id);
  };

  const findLaterQueuedIndex = (song: Song | null) => {
    const songIndex = findSongIndex(song);
    if (songIndex < 0) return -1;

    return queue.findIndex((queuedSong) => {
      const queuedSongIndex = songs.findIndex((candidate) => candidate.id === queuedSong.id);
      return queuedSongIndex > songIndex;
    });
  };

  const findEarlierQueuedIndex = (song: Song | null) => {
    const songIndex = findSongIndex(song);
    if (songIndex < 0) return -1;

    let previousQueueIndex = -1;
    queue.forEach((queuedSong, index) => {
      const queuedSongIndex = songs.findIndex((candidate) => candidate.id === queuedSong.id);
      if (queuedSongIndex >= 0 && queuedSongIndex < songIndex) {
        previousQueueIndex = index;
      }
    });
    return previousQueueIndex;
  };

  const playSong = (song: Song) => {
    const queueIndex = queue.findIndex((queuedSong) => queuedSong.id === song.id);
    if (queueIndex >= 0) {
      setCurrentSong(queue[queueIndex]);
      return;
    }

    setCurrentSong(song);
  };

  const playNext = () => {
    if (!currentDisplaySong) return;

    if (currentQueueIndex >= 0) {
      const nextQueueIndex = currentQueueIndex + 1;
      if (nextQueueIndex < queue.length) {
        setCurrentSong(queue[nextQueueIndex]);
        return;
      }

      stopPlayback();
      return;
    }

    const laterQueuedIndex = findLaterQueuedIndex(currentDisplaySong);
    if (laterQueuedIndex >= 0) {
      setCurrentSong(queue[laterQueuedIndex]);
      return;
    }

    stopPlayback();
  };

  const playPrevious = () => {
    if (!currentDisplaySong) return;

    if (currentQueueIndex >= 0) {
      const previousQueueIndex = currentQueueIndex - 1;
      if (previousQueueIndex >= 0) {
        setCurrentSong(queue[previousQueueIndex]);
      }
      return;
    }

    const earlierQueuedIndex = findEarlierQueuedIndex(currentDisplaySong);
    if (earlierQueuedIndex >= 0) {
      setCurrentSong(queue[earlierQueuedIndex]);
    }
  };

  const canGoNext =
    currentDisplaySong !== null &&
    (currentQueueIndex >= 0 ? currentQueueIndex < queue.length - 1 : findLaterQueuedIndex(currentDisplaySong) >= 0);

  const canGoPrevious =
    currentDisplaySong !== null &&
    (currentQueueIndex >= 0 ? currentQueueIndex > 0 : findEarlierQueuedIndex(currentDisplaySong) >= 0);

  return (
    <div className="App">
      <EmbeddedPlayerPanel
        currentSong={currentDisplaySong}
        onEnded={playNext}
        onNext={playNext}
        onPrevious={playPrevious}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
      />
      <AuthProvider>
        <ActionBar
          songs={songs}
          setSongs={setSongs}
          onPlayTop50={() => startQueue(songs.slice(0, 50))}
          onPlayRandom50={startQueue}
        />
        <SongList
          songs={songs}
          setSongs={setSongs}
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
