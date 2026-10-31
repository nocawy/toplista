import { fireEvent, render, screen } from "@testing-library/react";
import type { LyricsEditor } from "../../hooks/useLyricsEditor";
import LyricsEditorControls from "./LyricsEditorControls";

function editor(overrides: Partial<LyricsEditor> = {}): LyricsEditor {
  return {
    lyrics: null,
    offsetMs: 0,
    stored: null,
    canEdit: true,
    canAdjustTiming: true,
    saveStatus: "idle",
    adjust: jest.fn(),
    resetOffset: jest.fn(),
    keep: jest.fn(),
    forget: jest.fn(),
    ...overrides,
  };
}

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
