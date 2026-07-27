import { useEffect, useMemo, useState } from "react";
import type { Song } from "../components/Song";

export type QueueMode = "ranking" | "random";

type QueueDirection = "next" | "previous";

export function usePlaybackQueue(songs: Song[], songsSlug: string | null) {
  const [queueMode, setQueueMode] = useState<QueueMode>("ranking");
  const [queuedSongIds, setQueuedSongIds] = useState<number[]>([]);
  const [currentSongId, setCurrentSongId] = useState<number | null>(null);
  // The queue belongs to the ranking it was started in. A snapshot of that
  // ranking's songs keeps playback (and prev/next) working while the user
  // browses other rankings.
  const [queueSlug, setQueueSlug] = useState<string | null>(songsSlug);
  const [queueSongsSnapshot, setQueueSongsSnapshot] = useState<Song[]>([]);

  // Compare against the slug the loaded songs actually belong to, not the
  // selected tab: while a ranking switch is refetching, `songs` still holds
  // the previous ranking's list and must not be treated as the queue's.
  const isQueueRankingLoaded = songsSlug !== null && songsSlug === queueSlug;
  const queueSongs = isQueueRankingLoaded ? songs : queueSongsSnapshot;

  // While the queue's ranking is loaded, live data (reorders, edits) applies;
  // keep the snapshot in sync so it is fresh when the user navigates away.
  useEffect(() => {
    if (isQueueRankingLoaded) {
      setQueueSongsSnapshot(songs);
    }
  }, [songs, isQueueRankingLoaded]);

  const queuedSongIdSet = useMemo(() => new Set(queuedSongIds), [queuedSongIds]);

  const songIndexById = useMemo(() => {
    const indexById = new Map<number, number>();
    queueSongs.forEach((song, index) => {
      indexById.set(song.id, index);
    });
    return indexById;
  }, [queueSongs]);

  const randomQueue = useMemo(
    () => queueSongs.filter((song) => queuedSongIdSet.has(song.id)),
    [queueSongs, queuedSongIdSet]
  );

  const effectiveQueue = queueMode === "ranking" ? queueSongs : randomQueue;

  const currentDisplaySong = useMemo(
    () => queueSongs.find((song) => song.id === currentSongId) ?? null,
    [currentSongId, queueSongs]
  );

  const currentQueueIndex = currentDisplaySong
    ? effectiveQueue.findIndex((song) => song.id === currentDisplaySong.id)
    : -1;
  const isOnEffectiveQueue = currentQueueIndex >= 0;

  const stopPlayback = () => {
    setCurrentSongId(null);
  };

  const anchorQueueToCurrentRanking = () => {
    setQueueSlug(songsSlug);
    setQueueSongsSnapshot(songs);
  };

  const startRandomQueue = (subset: Song[]) => {
    const subsetIds = subset.map((song) => song.id);
    anchorQueueToCurrentRanking();
    setQueueMode("random");
    setQueuedSongIds(subsetIds);
    setCurrentSongId(subsetIds[0] ?? null);
  };

  const clearQueue = () => {
    setQueueMode("ranking");
    setQueuedSongIds([]);
  };

  const findRandomQueueNeighborIndex = (song: Song | null, direction: QueueDirection) => {
    if (!song) return -1;

    const songIndex = songIndexById.get(song.id);
    if (songIndex === undefined) return -1;

    if (direction === "next") {
      return randomQueue.findIndex((queuedSong) => {
        const queuedSongIndex = songIndexById.get(queuedSong.id);
        return queuedSongIndex !== undefined && queuedSongIndex > songIndex;
      });
    }

    for (let index = randomQueue.length - 1; index >= 0; index--) {
      const queuedSongIndex = songIndexById.get(randomQueue[index].id);
      if (queuedSongIndex !== undefined && queuedSongIndex < songIndex) {
        return index;
      }
    }

    return -1;
  };

  const playSong = (song: Song) => {
    if (!isQueueRankingLoaded) {
      // Starting playback in a different ranking abandons the old queue.
      setQueueMode("ranking");
      setQueuedSongIds([]);
      anchorQueueToCurrentRanking();
    }
    setCurrentSongId(song.id);
  };

  const playNext = () => {
    if (!currentDisplaySong) return;

    if (isOnEffectiveQueue) {
      const nextQueueIndex = currentQueueIndex + 1;
      if (nextQueueIndex < effectiveQueue.length) {
        setCurrentSongId(effectiveQueue[nextQueueIndex].id);
        return;
      }

      stopPlayback();
      return;
    }

    if (queueMode === "random") {
      const nextRandomQueueIndex = findRandomQueueNeighborIndex(currentDisplaySong, "next");
      if (nextRandomQueueIndex >= 0) {
        setCurrentSongId(randomQueue[nextRandomQueueIndex].id);
        return;
      }
    }

    stopPlayback();
  };

  const playPrevious = () => {
    if (!currentDisplaySong) return;

    if (isOnEffectiveQueue) {
      const previousQueueIndex = currentQueueIndex - 1;
      if (previousQueueIndex >= 0) {
        setCurrentSongId(effectiveQueue[previousQueueIndex].id);
      }
      return;
    }

    if (queueMode === "random") {
      const previousRandomQueueIndex = findRandomQueueNeighborIndex(currentDisplaySong, "previous");
      if (previousRandomQueueIndex >= 0) {
        setCurrentSongId(randomQueue[previousRandomQueueIndex].id);
      }
    }
  };

  const canGoNext =
    currentDisplaySong !== null &&
    (isOnEffectiveQueue
      ? currentQueueIndex < effectiveQueue.length - 1
      : queueMode === "random" && findRandomQueueNeighborIndex(currentDisplaySong, "next") >= 0);

  const canGoPrevious =
    currentDisplaySong !== null &&
    (isOnEffectiveQueue
      ? currentQueueIndex > 0
      : queueMode === "random" && findRandomQueueNeighborIndex(currentDisplaySong, "previous") >= 0);

  const playbackPositionLabel =
    queueMode === "random" && isOnEffectiveQueue && effectiveQueue.length > 0
      ? `${currentQueueIndex + 1}/${effectiveQueue.length}`
      : null;

  return {
    queueMode,
    // Queue highlighting only applies in the ranking the queue belongs to.
    queuedSongIds: isQueueRankingLoaded ? queuedSongIds : [],
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
  };
}
