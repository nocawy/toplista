import { Song } from "../Song";

interface PlayRandom50Props {
  songs: Song[];
  onPlayRandom: (selectedSongs: Song[]) => void;
}

const PlayRandom50: React.FC<PlayRandom50Props> = ({ songs, onPlayRandom }) => {
  function shuffle(o: number[]): number[] {
    // Fisher–Yates shuffle algorithm
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    for (let i = o.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]]; // ES6 array destructuring syntax for swapping elements
    }
    return o;
  }

  const handleClick = () => {
    const count = Math.min(50, songs.length);
    const indexes: number[] = [];
    for (let i = 0; i < songs.length; i++) indexes.push(i);

    const randoms = shuffle(indexes).slice(0, count).sort((a, b) => a - b);
    onPlayRandom(randoms.map((idx) => songs[idx]));
  };

  return (
    <button
      type="button"
      className="nav-link"
      onClick={handleClick}
    >
      play <br /> random 50
    </button>
  );
};

export default PlayRandom50;
