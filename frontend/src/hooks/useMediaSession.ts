import { useEffect, useRef } from "react";
import type { Song } from "../components/Song";

type MediaSessionAction = "previoustrack" | "nexttrack";

interface UseMediaSessionOptions {
  currentSong: Song | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

function buildMetadata(song: Song): MediaMetadata {
  return new MediaMetadata({
    title: song.s_title,
    artist: song.s_artist ?? "",
    artwork: [
      {
        src: `https://img.youtube.com/vi/${song.s_yt_id}/mqdefault.jpg`,
        sizes: "320x180",
        type: "image/jpeg",
      },
    ],
  });
}

function setTrackHandler(action: MediaSessionAction, handler: (() => void) | null) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Unsupported in some browsers/environments.
  }
}

export function useMediaSession({
  currentSong,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
}: UseMediaSessionOptions) {
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);

  useEffect(() => {
    onNextRef.current = onNext;
    onPreviousRef.current = onPrevious;
  }, [onNext, onPrevious]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      setTrackHandler("previoustrack", null);
      setTrackHandler("nexttrack", null);
      return;
    }

    navigator.mediaSession.metadata = buildMetadata(currentSong);

    setTrackHandler(
      "previoustrack",
      canGoPrevious
        ? () => {
            onPreviousRef.current();
          }
        : null
    );

    setTrackHandler(
      "nexttrack",
      canGoNext
        ? () => {
            onNextRef.current();
          }
        : null
    );

    return () => {
      navigator.mediaSession.metadata = null;
      setTrackHandler("previoustrack", null);
      setTrackHandler("nexttrack", null);
    };
  }, [currentSong, canGoNext, canGoPrevious]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!currentSong) return;

      if (event.code === "MediaTrackNext" && canGoNext) {
        event.preventDefault();
        onNextRef.current();
        return;
      }

      if (event.code === "MediaTrackPrevious" && canGoPrevious) {
        event.preventDefault();
        onPreviousRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSong, canGoNext, canGoPrevious]);
}
