import React, { useEffect, useState } from "react";
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

import SongComponent, { Song } from "./Song";

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}songs/`)
      .then((response) => response.json())
      .then((data) => setSongs(data))
      .catch((error) => console.error("Error getting songs:", error));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active != null && over != null) {
      if (active.id !== over.id) {
        setSongs((songs) => {
          const oldIndex = songs.findIndex((song) => song.id === active.id);
          const newIndex = songs.findIndex((song) => song.id === over.id);
          // const oldIndex = songs.indexOf(active.id);
          // const newIndex = songs.indexOf(over.id);
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
              {songs.map((song) => (
                <SongComponent key={song.id} song={song} />
              ))}
            </SortableContext>
          </DndContext>
        </tbody>
      </table>
    </div>
  );
};

export default SongList;