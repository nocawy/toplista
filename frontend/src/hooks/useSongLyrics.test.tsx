import { act, render, screen } from "@testing-library/react";
import { fetchSongLyrics, LyricsPayload } from "../api/lyricsService";
import type { Song } from "../components/Song";
import { useSongLyrics } from "./useSongLyrics";

jest.mock("../api/lyricsService", () => ({
  fetchSongLyrics: jest.fn(),
}));

const mockedFetchSongLyrics = fetchSongLyrics as jest.MockedFunction<typeof fetchSongLyrics>;

const baseSong: Song = {
  id: 1,
  s_yt_id: "abcdefghijk",
  s_artist: "Artist",
  s_title: "First song",
  s_album: "Album",
  s_released: 2020,
  s_discovered: "2020",
  s_comment: null,
  s_last_updated: "2026-08-23",
  s_created_on: "2026-08-23",
  r_rank: 1,
};

const firstLyrics: LyricsPayload = {
  found: true,
  provider: "lrclib",
  instrumental: false,
  synced: false,
  lines: [],
  plain: "First lyrics",
  stored: null,
};

let latest: ReturnType<typeof useSongLyrics>;

function LyricsHarness({ song }: { song: Song | null }) {
  latest = useSongLyrics(song, 180);
  return (
    <>
      <div data-testid="status">{latest.status}</div>
      <div>{latest.lyrics?.plain}</div>
    </>
  );
}

beforeEach(() => {
  mockedFetchSongLyrics.mockReset();
});

test("loads lyrics for the song with the video duration", async () => {
  mockedFetchSongLyrics.mockResolvedValueOnce(firstLyrics);

  render(<LyricsHarness song={baseSong} />);

  expect(await screen.findByText("First lyrics")).toBeInTheDocument();
  expect(mockedFetchSongLyrics).toHaveBeenCalledWith(1, 180, expect.any(AbortSignal));
});

test("does not render the previous song's lyrics while a new song loads", async () => {
  let resolveSecond!: (payload: LyricsPayload) => void;
  const secondRequest = new Promise<LyricsPayload>((resolve) => {
    resolveSecond = resolve;
  });
  mockedFetchSongLyrics.mockResolvedValueOnce(firstLyrics);
  mockedFetchSongLyrics.mockReturnValueOnce(secondRequest);

  const { rerender } = render(<LyricsHarness song={baseSong} />);

  expect(await screen.findByText("First lyrics")).toBeInTheDocument();

  rerender(
    <LyricsHarness
      song={{
        ...baseSong,
        id: 2,
        s_yt_id: "lmnopqrstuv",
        s_title: "Second song",
      }}
    />
  );

  expect(screen.getByTestId("status")).toHaveTextContent("loading");
  expect(screen.queryByText("First lyrics")).not.toBeInTheDocument();

  await act(async () => {
    resolveSecond({ ...firstLyrics, plain: "Second lyrics" });
    await secondRequest;
  });
});

test("shows saved lyrics only for the song they were saved for", async () => {
  mockedFetchSongLyrics.mockResolvedValueOnce(firstLyrics);
  render(<LyricsHarness song={baseSong} />);
  await screen.findByText("First lyrics");

  act(() => latest.replaceLyrics(2, { ...firstLyrics, plain: "Other song" }));
  expect(screen.getByText("First lyrics")).toBeInTheDocument();

  act(() => latest.replaceLyrics(1, { ...firstLyrics, plain: "Saved lyrics" }));
  expect(screen.getByText("Saved lyrics")).toBeInTheDocument();
});

test("reload fetches the lyrics again", async () => {
  mockedFetchSongLyrics.mockResolvedValueOnce(firstLyrics);
  mockedFetchSongLyrics.mockResolvedValueOnce({ ...firstLyrics, plain: "Live again" });
  render(<LyricsHarness song={baseSong} />);
  await screen.findByText("First lyrics");

  act(() => latest.reload());

  expect(await screen.findByText("Live again")).toBeInTheDocument();
  expect(mockedFetchSongLyrics).toHaveBeenCalledTimes(2);
});
