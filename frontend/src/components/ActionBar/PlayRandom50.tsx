import React, { useState } from "react";
import { Song } from "../Song";

interface PlayRandom50Props {
  songs: Song[];
  onRandomSelected?: (selectedSongIds: number[]) => void;
}

const PlayRandom50: React.FC<PlayRandom50Props> = ({ songs, onRandomSelected }) => {
  const [selectedSongIds, setSelectedSongIds] = useState<number[] | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  function shuffle(o: number[]): number[] {
    // Fisher–Yates shuffle algorithm
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    for (let i = o.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]]; // ES6 array destructuring syntax for swapping elements
    }
    return o;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const count = Math.min(50, songs.length);
    const indexes: number[] = [];
    for (let i = 0; i < songs.length; i++) indexes.push(i);

    const randoms = shuffle(indexes).slice(0, count).sort((a, b) => a - b);
    const playlistIds = randoms.map((idx) => songs[idx].s_yt_id);
    const ids = randoms.map((idx) => songs[idx].id);
    const url =
      "https://www.youtube.com/watch_videos?video_ids=" + playlistIds.join(",");

    setSelectedSongIds(ids);
    setPlaylistUrl(url);
    onRandomSelected?.(ids);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <a
      className="nav-link"
      href={playlistUrl ?? "#"}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      title={playlistUrl ? playlistUrl : "Generate random playlist"}
    >
      play <br /> random 50
    </a>
  );
};

export default PlayRandom50;
