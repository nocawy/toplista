import { useEffect, useState } from "react";
import { Song } from "../Song";
import { useRanking } from "../../contexts/RankingContext";
import {
  clampRandomPlayCount,
  getRandomPlayCount,
  setRandomPlayCount,
} from "../../utils/randomPlayCount";
import type { QueueMode } from "../../hooks/usePlaybackQueue";

interface PlayRandomProps {
  songs: Song[];
  queueMode: QueueMode;
  onPlayRandom: (selectedSongs: Song[]) => void;
  onClearQueue: () => void;
}

function shuffleIndexes(length: number): number[] {
  const indexes = Array.from({ length }, (_, i) => i);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

const PlayRandom: React.FC<PlayRandomProps> = ({ songs, queueMode, onPlayRandom, onClearQueue }) => {
  const { currentSlug } = useRanking();
  const [countInput, setCountInput] = useState<string>(() =>
    String(clampRandomPlayCount(getRandomPlayCount(currentSlug), songs.length))
  );

  useEffect(() => {
    setCountInput(String(clampRandomPlayCount(getRandomPlayCount(currentSlug), songs.length)));
  }, [currentSlug, songs.length]);

  const persistCount = (count: number) => {
    const clamped = clampRandomPlayCount(count, songs.length);
    setRandomPlayCount(currentSlug, clamped);
    setCountInput(String(clamped));
    return clamped;
  };

  const handleInputBlur = () => {
    const parsed = parseInt(countInput, 10);
    if (!Number.isFinite(parsed)) {
      setCountInput(String(clampRandomPlayCount(getRandomPlayCount(currentSlug), songs.length)));
      return;
    }
    persistCount(parsed);
  };

  const handlePlayRandom = () => {
    if (songs.length === 0) return;

    const parsed = parseInt(countInput, 10);
    const count = persistCount(Number.isFinite(parsed) ? parsed : getRandomPlayCount(currentSlug));
    const randomIndexes = shuffleIndexes(songs.length)
      .slice(0, count)
      .sort((a, b) => a - b);

    onPlayRandom(randomIndexes.map((idx) => songs[idx]));
  };

  const isDisabled = songs.length === 0;
  const canClearQueue = queueMode === "random";

  return (
    <div className="play-random-controls">
      <div className="play-random-main">
        <input
          type="number"
          className="play-random-count"
          min={1}
          max={Math.max(1, songs.length)}
          value={countInput}
          onChange={(e) => setCountInput(e.target.value)}
          onBlur={handleInputBlur}
          disabled={isDisabled}
          aria-label="Random playlist size"
        />
        <button
          type="button"
          className="nav-link"
          onClick={handlePlayRandom}
          disabled={isDisabled}
        >
          play <br /> random
        </button>
      </div>
      <button
        type="button"
        className="play-clear-queue"
        onClick={onClearQueue}
        disabled={!canClearQueue}
      >
        clear queue
      </button>
    </div>
  );
};

export default PlayRandom;
