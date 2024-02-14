import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface Song {
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

interface SongProps {
  song: Song;
  index: number; // row number
}

const SongComponent: React.FC<SongProps> = ({ song, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: song.id,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <div className="drag-handle" {...attributes} {...listeners}>
          &equiv; {/* ≡ */}
        </div>
      </td>
      <td>{index}</td>
      <td>
        <a
          className="play-link"
          href={`https://www.youtube.com/watch?v=${song.s_yt_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          &#x23F5; {/* ⏵,  &#9654; &#x25B6; ▶ */}
        </a>
      </td>
      <td>{song.s_artist}</td>
      <td>{song.s_title}</td>
      <td>{song.s_album || "-"}</td>
      <td>{song.s_released || "-"}</td>
      <td>{song.s_discovered || "-"}</td>
      <td>{song.s_comment || "-"}</td>
    </tr>
  );
};

export default SongComponent;
