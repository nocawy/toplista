import { Song } from "../Song";

interface PlayRandom50Props {
  songs: Song[];
}

const PlayRandom50: React.FC<PlayRandom50Props> = ({ songs }) => {
  function shuffle(o: number[]): number[] {
    // Fisher–Yates shuffle algorithm
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    for (let i = o.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]]; // ES6 array destructuring syntax for swapping elements
    }
    return o;
  }

  function randPlaylist(num: number, songs: Song[]): string {
    let numbers: number[] = [];
    for (let i = 0; i < songs.length; i++) {
      numbers.push(i);
    }

    let randoms = shuffle(numbers).slice(0, num);
    randoms.sort((a, b) => a - b);

    let playlistSongs = randoms.map((index) => songs[index].s_yt_id);

    return (
      "https://www.youtube.com/watch_videos?video_ids=" +
      playlistSongs.join(",")
    );
  }

  return (
    <a
      className="nav-link"
      href={randPlaylist(50, songs)}
      target="_blank"
      rel="noopener noreferrer"
    >
      play <br /> random 50
    </a>
  );
};

export default PlayRandom50;
