import React from "react";
import type { LyricsEditor } from "../../hooks/useLyricsEditor";
import LyricsOffsetControls from "./LyricsOffsetControls";
import LyricsSourceSwitcher from "./LyricsSourceSwitcher";

const STORED_LABELS = {
  manual: { text: "saved", title: "Saved for this song (chosen in the player)" },
  verified: { text: "verified", title: "Saved for this song (checked against the audio)" },
};

const LyricsEditorControls: React.FC<{ editor: LyricsEditor }> = ({ editor }) => {
  const stored = editor.stored ? STORED_LABELS[editor.stored.status] : null;

  return (
    <div className="player-lyrics-tools">
      <LyricsSourceSwitcher editor={editor} />
      {editor.canAdjustTiming && (
        <LyricsOffsetControls
          offsetMs={editor.offsetMs}
          onAdjust={editor.adjust}
          onReset={editor.resetOffset}
        />
      )}
      {(stored || editor.canKeep) && (
        <div className="player-lyrics-tool-group" role="group" aria-label="Saved lyrics">
          {stored ? (
            <>
              <span className="player-lyrics-saved" title={stored.title}>
                ✓ {stored.text}
              </span>
              <button
                type="button"
                className="player-lyrics-tool-button"
                onClick={editor.forget}
                title="Forget the saved lyrics and look them up again"
              >
                forget
              </button>
            </>
          ) : (
            <button
              type="button"
              className="player-lyrics-tool-button"
              onClick={editor.keep}
              title="Keep these lyrics for this song"
            >
              keep
            </button>
          )}
        </div>
      )}
      {editor.saveStatus === "error" && (
        <span className="player-lyrics-tools-error" role="status">
          not saved
        </span>
      )}
    </div>
  );
};

export default LyricsEditorControls;
