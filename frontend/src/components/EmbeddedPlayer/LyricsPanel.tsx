import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "../Song";
import { useSongLyrics } from "../../hooks/useSongLyrics";
import { findActiveLyricIndex } from "../../utils/lyrics";
import "./LyricsPanel.css";

interface LyricsPanelProps {
  song: Song | null;
  currentTimeSeconds: number;
  durationSeconds: number | null;
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({
  song,
  currentTimeSeconds,
  durationSeconds,
}) => {
  const { lyrics, status } = useSongLyrics(song, durationSeconds);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const previousIndexRef = useRef(-1);
  const [followPlayback, setFollowPlayback] = useState(true);

  const activeIndex =
    lyrics?.synced && lyrics.lines.length
      ? findActiveLyricIndex(lyrics.lines, Math.max(0, currentTimeSeconds) * 1000)
      : -1;

  const centerActiveLine = useCallback((behavior: ScrollBehavior) => {
    const line = activeLineRef.current;
    const container = bodyRef.current;
    if (!line || !container) return;

    const lineRect = line.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const lineCenter =
      container.scrollTop + lineRect.top - containerRect.top + lineRect.height / 2;
    const target = lineCenter - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior });
  }, []);

  useEffect(() => {
    if (!followPlayback || activeIndex < 0) return;

    const behavior: ScrollBehavior =
      Math.abs(previousIndexRef.current - activeIndex) <= 1 ? "smooth" : "auto";
    previousIndexRef.current = activeIndex;
    centerActiveLine(behavior);
  }, [activeIndex, centerActiveLine, followPlayback, lyrics]);

  useEffect(() => {
    previousIndexRef.current = -1;
    setFollowPlayback(true);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [song?.id, song?.s_yt_id]);

  return (
    <section className="player-lyrics" aria-label="Lyrics">
      {song ? (
        <div className="player-current-song">
          {song.s_artist && `${song.s_artist} - `}
          {song.s_title}
        </div>
      ) : (
        <div className="player-current-song player-lyrics-empty">No song playing</div>
      )}
      <div
        className="player-lyrics-body"
        ref={bodyRef}
        tabIndex={0}
        onWheel={() => {
          setFollowPlayback(false);
        }}
        onPointerDown={() => {
          setFollowPlayback(false);
        }}
        onPointerLeave={() => {
          previousIndexRef.current = -1;
          setFollowPlayback(true);
        }}
      >
        {renderLyricsBody(status, lyrics, activeIndex, activeLineRef)}
      </div>
    </section>
  );
};

function renderLyricsBody(
  status: string,
  lyrics: ReturnType<typeof useSongLyrics>["lyrics"],
  activeIndex: number,
  activeLineRef: React.MutableRefObject<HTMLDivElement | null>
) {
  if (status === "idle") {
    return <div className="player-lyrics-status">Play a song to see lyrics</div>;
  }
  if (status === "loading") {
    return <div className="player-lyrics-status">Loading lyrics…</div>;
  }
  if (status === "error") {
    return <div className="player-lyrics-status">Could not load lyrics</div>;
  }
  if (!lyrics?.found) {
    return <div className="player-lyrics-status">No lyrics found</div>;
  }
  if (lyrics.instrumental) {
    return <div className="player-lyrics-status">Instrumental</div>;
  }
  if (lyrics.synced && lyrics.lines.length > 0) {
    return lyrics.lines.map((line, index) => (
      <div
        key={`${line.start_ms}-${index}`}
        className={`player-lyrics-line${index === activeIndex ? " is-active" : ""}`}
        ref={(element) => {
          if (index === activeIndex) {
            activeLineRef.current = element;
          }
        }}
      >
        {line.text}
      </div>
    ));
  }
  if (lyrics.plain) {
    return <div className="player-lyrics-plain">{lyrics.plain}</div>;
  }
  return <div className="player-lyrics-status">No lyrics found</div>;
}

export default LyricsPanel;
