import { forwardRef, useEffect, useImperativeHandle } from "react";
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
import { updateSongRank, addNewSong } from "../api/songService";
import { useAuth } from "../contexts/AuthContext";
import type { QueueMode } from "../hooks/usePlaybackQueue";

interface SongListProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  rankingSlug: string;
  refreshSongs: (slug?: string) => Promise<Song[] | null>;
  isLoading: boolean;
  error: string | null;
  queueMode: QueueMode;
  queuedSongIds?: number[];
  currentSongId?: number | null;
  onPlaySong: (song: Song) => void;
}

export interface SongListHandle {
  scrollToSong: (songId: number) => void;
}

const SongList = forwardRef<SongListHandle, SongListProps>(function SongList(
  {
    songs,
    setSongs,
    rankingSlug,
    refreshSongs,
    isLoading,
    error,
    queueMode,
    queuedSongIds,
    currentSongId,
    onPlaySong,
  },
  ref
) {
  const { isLoggedIn } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // delay: 0,
        distance: 0,
      },
    })
  );

  useImperativeHandle(ref, () => ({
    scrollToSong: (songId: number) => {
      document.getElementById(`song-row-${songId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    },
  }));

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  const handleDragStart = () => {
    document.body.style.cursor = "grabbing";
  };

  const handleDragCancel = () => {
    document.body.style.cursor = "";
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
        await updateSongRank({ songId: active.id, newRank: newIndex + 1 }, rankingSlug);

        // 3) Fetch the updated song list with correct r_rank values from the server
        const updated = await refreshSongs(rankingSlug);
        if (!updated) return;
      } catch (error) {
        // Revalidate instead of applying a stale rollback after a ranking switch.
        await refreshSongs(rankingSlug);
        console.error("Error after dragging a song: ", error);
      }
    }
  };

  return (
    <div className="song-list-container">
      {isLoading && <div className="song-list-status">Loading ranking…</div>}
      {error && !isLoading && <div className="song-list-status error">{error}</div>}
      <div className="song-list-scroll">
        <DndContext
          key={rankingSlug}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          collisionDetection={closestCenter}
          modifiers={[
            restrictToVerticalAxis,
            restrictToWindowEdges,
            restrictToParentElement,
          ]}
        >
          <table>
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>Play</th>
                <th className="youtube-link-column">YT</th>
                <th>Artysta</th>
                <th>Tytuł</th>
                <th>Album</th>
                <th>Rok wydania</th>
                <th>Rok odkrycia</th>
                <th>Komentarz</th>
                <th className="song-actions-column"></th>
              </tr>
            </thead>
            <tbody>
              <SortableContext
                key={rankingSlug}
                items={songs.map((song) => song.id)}
                strategy={verticalListSortingStrategy}
              >
                {songs.map((song, index) => (
                  <SongComponent
                    key={song.id}
                    song={song}
                    index={index + 1}
                    songsCount={songs.length}
                    rankingSlug={rankingSlug}
                    refreshSongs={refreshSongs}
                    isQueued={queueMode === "random" && (queuedSongIds?.includes(song.id) ?? false)}
                    isCurrentlyPlaying={currentSongId === song.id}
                    onPlaySong={onPlaySong}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
      {isLoggedIn && !isLoading && !error && (
        <div className="form-holder">
          <AddSongForm
            addNewSong={(newSong) => addNewSong(newSong, rankingSlug)}
            rankingSlug={rankingSlug}
            refreshSongs={refreshSongs}
            nextRank={songs.length + 1}
          />
        </div>
      )}
    </div>
  );
});

export default SongList;
