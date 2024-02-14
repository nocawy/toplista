import { useState, useEffect } from "react";
import { Song } from "../components/Song";

const useTop50Link = (songs: Song[]): string => {
  const [top50Link, setTop50Link] = useState<string>("");

  useEffect(() => {
    // Update "Play Top 50" link whenever the song list changes
    const top50IDs = songs
      .slice(0, 50)
      .map((song) => song.s_yt_id)
      .join(",");
    setTop50Link(`https://www.youtube.com/watch_videos?video_ids=${top50IDs}`);
  }, [songs]); // Dependency on `songs` ensures the link is updated after the song list changes

  return top50Link;
};

export default useTop50Link;
