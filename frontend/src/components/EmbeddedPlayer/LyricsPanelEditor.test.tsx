import { render, screen } from "@testing-library/react";
import type { LyricsPayload } from "../../api/lyricsService";
import type { Song } from "../Song";
import LyricsPanel from "./LyricsPanel";

jest.mock("../../api/lyricsService", () => ({
  saveSongLyrics: jest.fn(),
  forgetSongLyrics: jest.fn(),
}));

const lines = [
  { start_ms: 0, text: "first line" },
  { start_ms: 10_000, text: "second line" },
  { start_ms: 20_000, text: "third line" },
];

let mockLyrics: LyricsPayload;

jest.mock("../../hooks/useSongLyrics", () => ({
  useSongLyrics: () => ({
    status: "ready",
    lyrics: mockLyrics,
    replaceLyrics: jest.fn(),
    reload: jest.fn(),
  }),
}));

const song: Song = {
  id: 1,
  s_yt_id: "abcdefghijk",
  s_artist: "Artist",
  s_title: "Title",
  s_album: null,
  s_released: null,
  s_discovered: null,
  s_comment: null,
  s_last_updated: "",
  s_created_on: "",
  r_rank: 1,
};

const live: LyricsPayload = {
  found: true,
  provider: "test",
  instrumental: false,
  synced: true,
  plain: null,
  fingerprint: "aaaa",
  lines,
  stored: null,
};

function activeLineText(container: HTMLElement) {
  return container.querySelector(".player-lyrics-line.is-active")?.textContent;
}

test("stored lyrics are highlighted with their saved offset", () => {
  mockLyrics = live;
  const { container, rerender } = render(
    <LyricsPanel song={song} currentTimeSeconds={15} durationSeconds={180} />
  );
  expect(activeLineText(container)).toBe("second line");

  mockLyrics = { ...live, stored: { status: "manual", offset_ms: 10_000, source_id: "", updated_on: "" } };
  rerender(<LyricsPanel song={song} currentTimeSeconds={15} durationSeconds={180} />);
  expect(activeLineText(container)).toBe("first line");
});

test("lyrics tools are only offered to users who may edit", () => {
  mockLyrics = live;
  const { rerender } = render(
    <LyricsPanel song={song} currentTimeSeconds={0} durationSeconds={180} />
  );
  expect(screen.queryByRole("button", { name: "keep" })).not.toBeInTheDocument();

  rerender(<LyricsPanel song={song} currentTimeSeconds={0} durationSeconds={180} canEditLyrics />);
  expect(screen.getByRole("button", { name: "keep" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Lyrics timing" })).toBeInTheDocument();
});
