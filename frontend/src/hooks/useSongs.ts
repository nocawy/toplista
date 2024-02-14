import { useState, useEffect } from "react";
import { fetchSongs } from "../api/songService";
import { Song } from "../components/Song";

const useSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    const loadSongs = async () => {
      const songsData = await fetchSongs();
      setSongs(songsData);
    };
    loadSongs();
  }, []);

  return { songs, setSongs };
};

export default useSongs;
