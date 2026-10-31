import { act, render, screen } from "@testing-library/react";
import { forgetSongLyrics, LyricsPayload, saveSongLyrics } from "../api/lyricsService";
import type { Song } from "../components/Song";
import { useLyricsEditor } from "./useLyricsEditor";

jest.mock("../api/lyricsService", () => ({
  saveSongLyrics: jest.fn(),
  forgetSongLyrics: jest.fn(),
}));

const mockedSave = saveSongLyrics as jest.MockedFunction<typeof saveSongLyrics>;
const mockedForget = forgetSongLyrics as jest.MockedFunction<typeof forgetSongLyrics>;

const song: Song = {
  id: 1,
  s_yt_id: "abcdefghijk",
  s_artist: "Artist",
  s_title: "Song",
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
  provider: "lrclib",
  instrumental: false,
  synced: true,
  lines: [{ start_ms: 14_530, text: "Oh, life" }],
  plain: "Oh, life",
  fingerprint: "aaaa",
  stored: null,
};

const stored: LyricsPayload = {
  ...live,
  stored: { status: "verified", offset_ms: 17_000, source_id: "9273844", updated_on: "" },
};

let latest: ReturnType<typeof useLyricsEditor>;
const onSaved = jest.fn();
const onForgotten = jest.fn();

function Harness({
  song,
  lyrics,
  enabled = true,
}: {
  song: Song | null;
  lyrics: LyricsPayload | null;
  enabled?: boolean;
}) {
  latest = useLyricsEditor(song, lyrics, { enabled, onSaved, onForgotten });
  return <div data-testid="offset">{latest.offsetMs}</div>;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedSave.mockReset();
  mockedForget.mockReset();
  onSaved.mockReset();
  onForgotten.mockReset();
  mockedSave.mockImplementation(async (_songId, input) => ({
    ...live,
    stored: { status: "manual", offset_ms: input.offset_ms, source_id: input.source_id, updated_on: "" },
  }));
  mockedForget.mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
});

test("stored lyrics bring their offset; live lyrics start in sync", () => {
  const { rerender } = render(<Harness song={song} lyrics={stored} />);
  expect(screen.getByTestId("offset")).toHaveTextContent("17000");

  rerender(<Harness song={song} lyrics={live} />);
  expect(screen.getByTestId("offset")).toHaveTextContent(/^0$/);
});

test("adjusting the timing saves the shown lyrics with the offset once the user stops", async () => {
  render(<Harness song={song} lyrics={live} />);

  act(() => latest.adjust(5_000));
  act(() => latest.adjust(500));
  expect(screen.getByTestId("offset")).toHaveTextContent("5500");
  expect(mockedSave).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(600);
  });

  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(mockedSave).toHaveBeenCalledWith(1, {
    provider: "lrclib",
    source_id: "",
    instrumental: false,
    lines: live.lines,
    plain: "Oh, life",
    offset_ms: 5_500,
  });
  expect(onSaved).toHaveBeenCalledWith(1, expect.objectContaining({ stored: expect.anything() }));
});

test("keep saves right away and keeps the source of stored lyrics", async () => {
  render(<Harness song={song} lyrics={stored} />);

  await act(async () => {
    latest.keep();
  });

  expect(mockedSave).toHaveBeenCalledWith(1, expect.objectContaining({ offset_ms: 17_000, source_id: "9273844" }));
});

test("a pending adjustment is saved when the song changes", () => {
  const { rerender } = render(<Harness song={song} lyrics={live} />);

  act(() => latest.adjust(-500));
  rerender(<Harness song={{ ...song, id: 2 }} lyrics={{ ...live, fingerprint: "bbbb" }} />);

  expect(mockedSave).toHaveBeenCalledWith(1, expect.objectContaining({ offset_ms: -500 }));
});

test("forget deletes the saved lyrics and asks for them again", async () => {
  render(<Harness song={song} lyrics={stored} />);

  await act(async () => {
    latest.forget();
  });

  expect(mockedForget).toHaveBeenCalledWith(1);
  expect(onForgotten).toHaveBeenCalled();
});

test("timing stays within five minutes and only applies to synced lyrics", () => {
  const { rerender } = render(<Harness song={song} lyrics={live} />);
  act(() => latest.adjust(10 * 60 * 1000));
  expect(screen.getByTestId("offset")).toHaveTextContent("300000");

  rerender(<Harness song={song} lyrics={{ ...live, synced: false, lines: [], fingerprint: null }} />);
  expect(latest.canAdjustTiming).toBe(false);
  expect(latest.canEdit).toBe(true);
});

test("listeners get the stored timing but cannot change it", () => {
  render(<Harness song={song} lyrics={stored} enabled={false} />);

  act(() => latest.adjust(500));

  expect(screen.getByTestId("offset")).toHaveTextContent("17000");
  expect(latest.canEdit).toBe(false);
});

test("reports a failed save", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockedSave.mockRejectedValueOnce(new Error("offline"));
  render(<Harness song={song} lyrics={live} />);

  await act(async () => {
    latest.keep();
  });

  expect(latest.saveStatus).toBe("error");
  consoleError.mockRestore();
});
