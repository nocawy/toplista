import React, { useEffect, useState } from 'react';
import SongComponent, { Song } from './Song';

const SongList: React.FC = () => {
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
            <th>Link</th>
            <th>Artysta</th>
            <th>Tytuł</th>
            <th>Album</th>
            <th>Rok wydania</th>
            <th>Rok odkrycia</th>
            <th>Komentarz</th>
          </tr>
        </thead>
        <tbody>
          {songs.map(song => (
            <SongComponent key={song.id} song={song} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SongList;