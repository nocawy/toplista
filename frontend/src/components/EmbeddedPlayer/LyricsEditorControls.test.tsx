import { fireEvent, render, screen } from "@testing-library/react";
import type { LyricsCandidate } from "../../api/lyricsService";
import type { LyricsEditor } from "../../hooks/useLyricsEditor";
import LyricsEditorControls from "./LyricsEditorControls";
import { describeLyricsSource } from "./LyricsSourceSwitcher";

function editor(overrides: Partial<LyricsEditor> = {}): LyricsEditor {
  return {
    lyrics: {
      found: true,
      provider: "lrclib",
      instrumental: false,
      synced: true,
      lines: [],
      plain: null,
    },
    offsetMs: 0,
    stored: null,
    canEdit: true,
    canKeep: true,
    canAdjustTiming: true,
    saveStatus: "idle",
    adjust: jest.fn(),
    resetOffset: jest.fn(),
    keep: jest.fn(),
    forget: jest.fn(),
    candidates: { status: "idle", total: 0, position: null, incomplete: false, current: null },
    showNextCandidate: jest.fn(),
    showPreviousCandidate: jest.fn(),
    ...overrides,
  };
}

const albumCandidate: LyricsCandidate = {
  found: true,
  provider: "lrclib",
  instrumental: false,
  synced: true,
  lines: [],
  plain: null,
  id: "aaaa",
  source_id: "1",
  label: "R.E.M. - Losing My Religion (Out of Time)",
  providers: ["lrclib"],
  durations: [266, 307],
  records: 18,
  exact_match: false,
  ends_after_video: true,
  version_mismatch: false,
};

test("offers to keep lyrics that are not saved yet", () => {
  const keep = jest.fn();
  render(<LyricsEditorControls editor={editor({ keep })} />);

  fireEvent.click(screen.getByRole("button", { name: "keep" }));

  expect(keep).toHaveBeenCalled();
  expect(screen.getByRole("group", { name: "Lyrics timing" })).toBeInTheDocument();
});

test("shows how saved lyrics were chosen and lets them be forgotten", () => {
  const forget = jest.fn();
  render(
    <LyricsEditorControls
      editor={editor({
        forget,
        stored: { status: "verified", offset_ms: 0, source_id: "", updated_on: "" },
      })}
    />
  );

  expect(screen.getByText("✓ verified")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "forget" }));
  expect(forget).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "keep" })).not.toBeInTheDocument();
});

test("hides timing for unsynced lyrics and reports failed saves", () => {
  render(<LyricsEditorControls editor={editor({ canAdjustTiming: false, saveStatus: "error" })} />);

  expect(screen.queryByRole("group", { name: "Lyrics timing" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("not saved");
});

test("switches between lyrics candidates", () => {
  const showNextCandidate = jest.fn();
  const showPreviousCandidate = jest.fn();
  render(
    <LyricsEditorControls
      editor={editor({
        showNextCandidate,
        showPreviousCandidate,
        candidates: { status: "ready", total: 4, position: 2, incomplete: false, current: albumCandidate },
      })}
    />
  );

  expect(screen.getByRole("group", { name: "Lyrics source" })).toHaveTextContent("lrclib 2/4 ⚠");
  fireEvent.click(screen.getByRole("button", { name: "Next lyrics" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous lyrics" }));
  expect(showNextCandidate).toHaveBeenCalledTimes(1);
  expect(showPreviousCandidate).toHaveBeenCalledTimes(1);
});

test("explains what is known about the shown candidate", () => {
  const description = describeLyricsSource(
    editor({ candidates: { status: "ready", total: 4, position: 2, incomplete: true, current: albumCandidate } })
  );

  expect(description).toBe(
    "R.E.M. - Losing My Religion (Out of Time) · 18 matching records · recording 4:26–5:07 · " +
      "lyrics run past the end of the video · some sources did not answer, try again later"
  );
});

test("offers other lyrics even when none were found", () => {
  render(
    <LyricsEditorControls
      editor={editor({
        lyrics: { found: false, provider: null, instrumental: false, synced: false, lines: [], plain: null },
        canKeep: false,
        canAdjustTiming: false,
      })}
    />
  );

  expect(screen.getByRole("group", { name: "Lyrics source" })).toHaveTextContent("no lyrics");
  expect(screen.queryByRole("button", { name: "keep" })).not.toBeInTheDocument();
});
