import React from "react";
import type { LyricsEditor } from "../../hooks/useLyricsEditor";

function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function describeLyricsSource(editor: LyricsEditor): string {
  const { candidates } = editor;
  const current = candidates.current;
  const parts: string[] = [];
  if (current?.label) parts.push(current.label);
  if (current && current.records > 1) parts.push(`${current.records} matching records`);
  if (current && current.durations.length > 0) {
    const shortest = formatSeconds(Math.min(...current.durations));
    const longest = formatSeconds(Math.max(...current.durations));
    parts.push(`recording ${shortest === longest ? shortest : `${shortest}–${longest}`}`);
  }
  if (current?.exact_match) parts.push("exact match");
  if (current?.ends_after_video) parts.push("lyrics run past the end of the video");
  if (current?.version_mismatch) parts.push("looks like a different version");
  if (candidates.incomplete) parts.push("some sources did not answer, try again later");
  if (candidates.status === "error") parts.push("could not load other lyrics");
  return parts.join(" · ") || "Show other lyrics for this song";
}

const LyricsSourceSwitcher: React.FC<{ editor: LyricsEditor }> = ({ editor }) => {
  const { candidates } = editor;
  const source = editor.lyrics?.found ? editor.lyrics.provider : "no lyrics";
  const count =
    candidates.status === "loading"
      ? "…"
      : candidates.status === "ready"
        ? `${candidates.position ?? "–"}/${candidates.total}`
        : "";
  const hasWarning =
    candidates.status === "error" ||
    candidates.incomplete ||
    !!candidates.current?.ends_after_video ||
    !!candidates.current?.version_mismatch;
  const noAlternatives = candidates.status === "ready" && candidates.total === 0;

  return (
    <div className="player-lyrics-tool-group" role="group" aria-label="Lyrics source">
      <div className="player-lyrics-tool-row">
        <button
          type="button"
          className="player-lyrics-tool-button"
          onClick={editor.showPreviousCandidate}
          disabled={noAlternatives}
          title="Previous lyrics"
          aria-label="Previous lyrics"
        >
          ‹
        </button>
        <button
          type="button"
          className="player-lyrics-tool-button"
          onClick={editor.showNextCandidate}
          disabled={noAlternatives}
          title="Next lyrics"
          aria-label="Next lyrics"
        >
          ›
        </button>
      </div>
      <span className="player-lyrics-source" title={describeLyricsSource(editor)}>
        <span>{source}</span>
        {(count || hasWarning) && (
          <span>
            {count}
            {hasWarning && " ⚠"}
          </span>
        )}
      </span>
    </div>
  );
};

export default LyricsSourceSwitcher;
