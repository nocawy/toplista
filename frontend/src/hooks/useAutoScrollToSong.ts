import { useEffect } from "react";

const SONG_ROW_ID_PREFIX = "song-row-";

function getViewportInsets(): { top: number; bottom: number } {
  const playerHeader = document.querySelector(".player-header");
  const top =
    playerHeader instanceof HTMLElement ? playerHeader.getBoundingClientRect().bottom : 0;

  return { top, bottom: window.innerHeight };
}

function getSongRow(songId: number): HTMLElement | null {
  return document.getElementById(`${SONG_ROW_ID_PREFIX}${songId}`);
}

function isSongRowFullyVisible(songId: number): boolean {
  const element = getSongRow(songId);
  if (!element) return true;

  const rect = element.getBoundingClientRect();
  const { top, bottom } = getViewportInsets();

  return rect.top >= top && rect.bottom <= bottom;
}

function scrollSongRowIntoView(songId: number): void {
  getSongRow(songId)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

export function useAutoScrollToSong(songId: number | null | undefined) {
  useEffect(() => {
    if (songId == null) return;

    const frameId = requestAnimationFrame(() => {
      if (!isSongRowFullyVisible(songId)) {
        scrollSongRowIntoView(songId);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [songId]);
}
