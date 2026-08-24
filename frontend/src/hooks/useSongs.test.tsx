import { act, fireEvent, render, screen } from "@testing-library/react";
import { fetchSongs } from "../api/songService";
import type { Song } from "../components/Song";
import { RankingProvider, useRanking } from "../contexts/RankingContext";
import useSongs from "./useSongs";

jest.mock("../api/songService", () => ({
  fetchSongs: jest.fn(),
}));

const mockedFetchSongs = fetchSongs as jest.MockedFunction<typeof fetchSongs>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function song(id: number, title: string): Song {
  return {
    id,
    s_yt_id: `videoid${String(id).padStart(4, "0")}`.slice(0, 11),
    s_artist: "Artist",
    s_title: title,
    s_album: null,
    s_released: null,
    s_discovered: null,
    s_comment: null,
    s_last_updated: "",
    s_created_on: "",
    r_rank: 1,
  };
}

function SongsHarness() {
  const { setCurrentSlug } = useRanking();
  const { songs, songsSlug } = useSongs();
  return (
    <>
      <button type="button" onClick={() => setCurrentSlug("second")}>
        switch
      </button>
      <div data-testid="slug">{songsSlug}</div>
      <div data-testid="songs">{songs.map((item) => item.s_title).join(",")}</div>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedFetchSongs.mockReset();
});

test("ignores a stale ranking response after switching rankings", async () => {
  const mainRequest = deferred<Song[]>();
  const secondRequest = deferred<Song[]>();
  mockedFetchSongs.mockImplementation((slug) =>
    slug === "main" ? mainRequest.promise : secondRequest.promise
  );

  render(
    <RankingProvider>
      <SongsHarness />
    </RankingProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: "switch" }));

  await act(async () => {
    secondRequest.resolve([song(2, "Second ranking song")]);
    await secondRequest.promise;
  });

  expect(screen.getByTestId("slug")).toHaveTextContent("second");
  expect(screen.getByTestId("songs")).toHaveTextContent("Second ranking song");

  await act(async () => {
    mainRequest.resolve([song(1, "Stale main song")]);
    await mainRequest.promise;
  });

  expect(screen.getByTestId("slug")).toHaveTextContent("second");
  expect(screen.getByTestId("songs")).not.toHaveTextContent("Stale main song");
});
