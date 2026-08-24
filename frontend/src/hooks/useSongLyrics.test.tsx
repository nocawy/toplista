import { act, render, screen, waitFor } from "@testing-library/react";
import { fetchLyrics, LyricsPayload } from "../api/lyricsService";
import type { Song } from "../components/Song";
import { useSongLyrics } from "./useSongLyrics";

jest.mock("../api/lyricsService", () => ({
  fetchLyrics: jest.fn(),
}));

const mockedFetchLyrics = fetchLyrics as jest.MockedFunction<typeof fetchLyrics>;

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
};

function LyricsHarness({ song }: { song: Song | null }) {
  const { lyrics, status } = useSongLyrics(song, 180);
  return (
    <>
      <div data-testid="status">{status}</div>
      <div>{lyrics?.plain}</div>
    </>
  );
}

test("does not render the previous song's lyrics while a new song loads", async () => {
  let resolveSecond!: (payload: LyricsPayload) => void;
  const secondRequest = new Promise<LyricsPayload>((resolve) => {
    resolveSecond = resolve;
  });
  mockedFetchLyrics.mockResolvedValueOnce(firstLyrics);
  mockedFetchLyrics.mockReturnValueOnce(secondRequest);

  const { rerender } = render(<LyricsHarness song={baseSong} />);

  await waitFor(() => expect(screen.getByText("First lyrics")).toBeInTheDocument());

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
