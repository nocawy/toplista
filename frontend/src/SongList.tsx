import React, { useEffect, useState } from 'react';

interface Song {
  id: number;
  s_yt_id: string;
  s_artist: string;
  s_title: string;
  s_album?: string; // optional
  s_released: number;
  s_discovered: number;
  s_comment?: string; // optional
  s_last_updated: string;
  s_created_on: string;
}

function SongList() {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}songs/`)
      .then(response => response.json())
      .then(data => setSongs(data))
      .catch(error => console.error("Error getting songs:", error));
  }, []);

  return (
    <div>
      <h1>Lista Piosenek</h1>
      <ul>
        {songs.map(song => (
          <li key={song.id}>{song.s_title} - {song.s_artist}</li>
        ))}
      </ul>
    </div>
  );
}

export default SongList;
