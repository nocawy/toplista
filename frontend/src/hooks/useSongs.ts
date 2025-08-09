import { useState, useEffect } from "react";
import { fetchSongs } from "../api/songService";
import { Song } from "../components/Song";
import { useRanking } from "../contexts/RankingContext";

const useSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const { currentSlug } = useRanking();

  useEffect(() => {
    const loadSongs = async () => {
      const songsData = await fetchSongs(currentSlug);
      setSongs(songsData);
    };
    loadSongs();
  }, [currentSlug]);

  return { songs, setSongs };
};

export default useSongs;
