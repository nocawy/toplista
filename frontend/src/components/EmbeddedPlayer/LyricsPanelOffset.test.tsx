import { render, screen } from "@testing-library/react";
import type { Song } from "../Song";
import LyricsPanel from "./LyricsPanel";

jest.mock("../../api/songService", () => ({
  updateSongLyricsOffset: jest.fn(),
}));

jest.mock("../../hooks/useSongLyrics", () => ({
  useSongLyrics: () => ({
    status: "ready",
    lyrics: {
      found: true,
      provider: "test",
      instrumental: false,
      synced: true,
      plain: null,
      fingerprint: "aaaa",
      lines: [
        { start_ms: 0, text: "first line" },
        { start_ms: 10_000, text: "second line" },
        { start_ms: 20_000, text: "third line" },
      ],
    },
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
  s_lyrics_offset_ms: 0,
  s_lyrics_offset_ref: "",
  s_last_updated: "",
  s_created_on: "",
  r_rank: 1,
};

function activeLineText(container: HTMLElement) {
  return container.querySelector(".player-lyrics-line.is-active")?.textContent;
}

test("a stored offset delays which line is highlighted", () => {
  const { container, rerender } = render(
    <LyricsPanel song={song} currentTimeSeconds={15} durationSeconds={180} />
  );
  expect(activeLineText(container)).toBe("second line");

  rerender(
    <LyricsPanel
      song={{ ...song, s_lyrics_offset_ms: 10_000, s_lyrics_offset_ref: "aaaa" }}
      currentTimeSeconds={15}
      durationSeconds={180}
    />
  );
  expect(activeLineText(container)).toBe("first line");
});

test("an offset saved for other lyrics is ignored", () => {
  const { container } = render(
    <LyricsPanel
      song={{ ...song, s_lyrics_offset_ms: 10_000, s_lyrics_offset_ref: "bbbb" }}
      currentTimeSeconds={15}
      durationSeconds={180}
    />
  );

  expect(activeLineText(container)).toBe("second line");
});

test("timing controls are only offered when the user may adjust them", () => {
  const { rerender } = render(
    <LyricsPanel song={song} currentTimeSeconds={0} durationSeconds={180} />
  );
  expect(screen.queryByRole("group", { name: "Lyrics timing" })).not.toBeInTheDocument();

  rerender(
    <LyricsPanel song={song} currentTimeSeconds={0} durationSeconds={180} canAdjustOffset />
  );
  expect(screen.getByRole("group", { name: "Lyrics timing" })).toBeInTheDocument();
});
