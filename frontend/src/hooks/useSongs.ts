import { useState, useEffect } from "react";
import { fetchSongs } from "../api/songService";
import { Song } from "../components/Song";
import { useRanking } from "../contexts/RankingContext";

const useSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  // The ranking the loaded songs belong to. Lags behind currentSlug while a
  // refetch is in flight, letting consumers detect stale data.
  const [songsSlug, setSongsSlug] = useState<string | null>(null);
  const { currentSlug } = useRanking();

  useEffect(() => {
    const loadSongs = async () => {
      const songsData = await fetchSongs(currentSlug);
      setSongs(songsData);
      setSongsSlug(currentSlug);
    };
    loadSongs();
  }, [currentSlug]);

  return { songs, setSongs, songsSlug };
};

export default useSongs;
