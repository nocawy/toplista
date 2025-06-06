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
import AddSongForm from "./AddSongForm";
import { updateSongRank, addNewSong, fetchSongs } from "../api/songService";
import { useAuth } from "../contexts/AuthContext";

interface SongListProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
}

const SongList: React.FC<SongListProps> = ({ songs, setSongs }) => {
  const { isLoggedIn } = useAuth();

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

  const handleDragEnd = async (event: any) => {
    document.body.style.cursor = "";
    const { active, over } = event;

    if (active && over && isLoggedIn && active.id !== over.id) {
      const oldIndex = songs.findIndex((song) => song.id === active.id);
      const newIndex = songs.findIndex((song) => song.id === over.id);

      // 1) Optimistically move the item in the UI
      setSongs((songs) => arrayMove(songs, oldIndex, newIndex));

      try {
        // 2) Notify the backend to update all affected ranks
        await updateSongRank({ songId: active.id, newRank: newIndex + 1 });

        // 3) Fetch the updated song list with correct r_rank values from the server
        const updated = await fetchSongs();
        setSongs(updated);
      } catch (error) {
        // 4) On error, rollback the optimistic UI update
        setSongs((songs) => arrayMove(songs, newIndex, oldIndex));
        console.error("Error after dragging a song: ", error);
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
                <SongComponent
                  key={song.id}
                  song={song}
                  index={index + 1} // pass index+1 so that numbering starts with 1
                  songsCount={songs.length}
                  setSongs={setSongs}
                />
              ))}
            </SortableContext>
          </DndContext>
        </tbody>
      </table>
      {isLoggedIn && (
        <div className="form-holder">
          <AddSongForm
            setSongs={setSongs}
            addNewSong={addNewSong}
            nextRank={songs.length + 1}
          />
        </div>
      )}
    </div>
  );
};

export default SongList;
