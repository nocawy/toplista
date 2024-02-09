import React, { useEffect, useState } from 'react';

interface Song {
  id: number;
  s_yt_id: string;
  s_artist: string;
  s_title: string;
  s_album?: string; // optional
  s_released?: number; // optional
  s_discovered?: number; // optional
  s_comment?: string; // optional
  s_last_updated: string;
  s_created_on: string;
  r_rank: number;
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
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>link</th>
            <th>Artysta</th>
            <th>Tytuł</th>
            <th>Album</th>
            <th>rok wydania</th>
            <th>rok odkrycia</th>
            <th>komentarz</th>
          </tr>
        </thead>
        <tbody>
          {songs.map(song => (
            <tr key={song.id}>
              <td>{song.r_rank}</td>
              <td><a href={`https://www.youtube.com/watch?v=${song.s_yt_id}`} target="_blank" rel="noopener noreferrer">play</a></td>
              <td>{song.s_artist}</td>
              <td>{song.s_title}</td>
              <td>{song.s_album || '-'}</td>
              <td>{song.s_released || '-'}</td>
              <td>{song.s_discovered || '-'}</td>
              <td>{song.s_comment || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SongList;
