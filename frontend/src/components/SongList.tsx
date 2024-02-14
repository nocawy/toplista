import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import "./SongList.css";
import SongComponent, { Song } from "./Song";
import { updateSongRank } from "../api/songService";

interface SongListProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
}

const SongList: React.FC<SongListProps> = ({ songs, setSongs }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // delay: 0,
        distance: 0,
      },
    })
  );

  const handleDragStart = (event: any) => {
    document.body.style.cursor = "grabbing";
  };

  const handleDragEnd = (event: any) => {
    document.body.style.cursor = "";
    const { active, over } = event;
    if (active != null && over != null) {
      if (active.id !== over.id) {
        setSongs((songs) => {
          const oldIndex = songs.findIndex((song) => song.id === active.id);
          const newIndex = songs.findIndex((song) => song.id === over.id);
          // const oldIndex = songs.indexOf(active.id);
          // const newIndex = songs.indexOf(over.id);
          updateSongRank({ songId: active.id, newRank: newIndex + 1 });
          return arrayMove(songs, oldIndex, newIndex);
        });
      }
    }
  };

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th></th>
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
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
            modifiers={[
              restrictToVerticalAxis,
              restrictToWindowEdges,
              restrictToParentElement,
            ]}
          >
            <SortableContext
              items={songs.map((song) => song.id)}
              strategy={verticalListSortingStrategy}
            >
              {songs.map((song, index) => (
                <SongComponent key={song.id} song={song} index={index + 1} /> // pass index+1 so that numbering starts with 1
              ))}
            </SortableContext>
          </DndContext>
        </tbody>
      </table>
    </div>
  );
};

export default SongList;
