import { act, render, screen } from "@testing-library/react";
import { updateSongLyricsOffset } from "../api/songService";
import type { Song } from "../components/Song";
import { useLyricsOffset } from "./useLyricsOffset";

jest.mock("../api/songService", () => ({
  updateSongLyricsOffset: jest.fn(),
}));

const mockedSave = updateSongLyricsOffset as jest.MockedFunction<typeof updateSongLyricsOffset>;

const song: Song = {
  id: 1,
  s_yt_id: "abcdefghijk",
  s_artist: "Artist",
  s_title: "Song",
  s_album: null,
  s_released: null,
  s_discovered: null,
  s_comment: null,
  s_lyrics_offset_ms: 17_000,
  s_lyrics_offset_ref: "aaaa",
  s_last_updated: "",
  s_created_on: "",
  r_rank: 1,
};
const unsyncedSong: Song = { ...song, s_lyrics_offset_ms: 0, s_lyrics_offset_ref: "" };

let latest: ReturnType<typeof useLyricsOffset>;

function Harness({ song, fingerprint }: { song: Song | null; fingerprint: string | null }) {
  latest = useLyricsOffset(song, fingerprint);
  return <div data-testid="offset">{latest.offsetMs}</div>;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedSave.mockReset();
  mockedSave.mockResolvedValue();
});

afterEach(() => {
  jest.useRealTimers();
});

test("applies a stored offset only to the lyrics it was saved for", () => {
  const { rerender } = render(<Harness song={song} fingerprint="aaaa" />);
  expect(screen.getByTestId("offset")).toHaveTextContent("17000");

  rerender(<Harness song={song} fingerprint="bbbb" />);
  expect(screen.getByTestId("offset")).toHaveTextContent(/^0$/);
  expect(latest.canAdjust).toBe(true);

  rerender(<Harness song={song} fingerprint={null} />);
  expect(latest.canAdjust).toBe(false);
});

test("saves the latest offset once after the user stops adjusting", async () => {
  render(<Harness song={unsyncedSong} fingerprint="aaaa" />);

  act(() => latest.adjust(5_000));
  act(() => latest.adjust(500));

  expect(screen.getByTestId("offset")).toHaveTextContent("5500");
  expect(mockedSave).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(mockedSave).toHaveBeenCalledWith(1, 5_500, "aaaa");
});

test("saves a pending adjustment right away when the song changes", () => {
  const { rerender } = render(<Harness song={unsyncedSong} fingerprint="aaaa" />);

  act(() => latest.adjust(-500));
  rerender(<Harness song={{ ...unsyncedSong, id: 2 }} fingerprint="cccc" />);

  expect(mockedSave).toHaveBeenCalledWith(1, -500, "aaaa");
  expect(screen.getByTestId("offset")).toHaveTextContent(/^0$/);
});

test("keeps the offset within five minutes", () => {
  render(<Harness song={unsyncedSong} fingerprint="aaaa" />);

  act(() => latest.adjust(10 * 60 * 1000));

  expect(screen.getByTestId("offset")).toHaveTextContent("300000");
});

test("reports a failed save", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockedSave.mockRejectedValueOnce(new Error("offline"));
  render(<Harness song={unsyncedSong} fingerprint="aaaa" />);

  act(() => latest.adjust(500));
  await act(async () => {
    jest.advanceTimersByTime(600);
  });

  expect(latest.saveStatus).toBe("error");
  consoleError.mockRestore();
});
