import React from "react";

interface LyricsOffsetControlsProps {
  offsetMs: number;
  onAdjust: (deltaMs: number) => void;
  onReset: () => void;
}

const EARLIER_STEPS_MS = [-5000, -500];
const LATER_STEPS_MS = [500, 5000];

export function formatLyricsOffset(offsetMs: number): string {
  const sign = offsetMs > 0 ? "+" : offsetMs < 0 ? "−" : "±";
  return `${sign}${(Math.abs(offsetMs) / 1000).toFixed(1)} s`;
}

const LyricsOffsetControls: React.FC<LyricsOffsetControlsProps> = ({
  offsetMs,
  onAdjust,
  onReset,
}) => {
  const renderStep = (deltaMs: number) => {
    const seconds = Math.abs(deltaMs) / 1000;
    const label = `Show lyrics ${seconds} s ${deltaMs < 0 ? "earlier" : "later"}`;
    return (
      <button
        key={deltaMs}
        type="button"
        className="player-lyrics-tool-button"
        onClick={() => onAdjust(deltaMs)}
        title={label}
        aria-label={label}
      >
        {deltaMs < 0 ? "−" : "+"}
        {seconds}s
      </button>
    );
  };

  return (
    <div className="player-lyrics-tool-group" role="group" aria-label="Lyrics timing">
      {EARLIER_STEPS_MS.map(renderStep)}
      <button
        type="button"
        className="player-lyrics-tool-button player-lyrics-offset-value"
        onClick={onReset}
        disabled={offsetMs === 0}
        title="Reset lyrics timing"
        aria-label={`Lyrics timing ${formatLyricsOffset(offsetMs)}, reset`}
      >
        {formatLyricsOffset(offsetMs)}
      </button>
      {LATER_STEPS_MS.map(renderStep)}
    </div>
  );
};

export default LyricsOffsetControls;
