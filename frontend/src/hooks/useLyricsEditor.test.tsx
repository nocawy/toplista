import { act, render, screen } from "@testing-library/react";
import {
  fetchLyricsCandidates,
  forgetSongLyrics,
  LyricsCandidate,
  LyricsPayload,
  saveSongLyrics,
} from "../api/lyricsService";
import type { Song } from "../components/Song";
import { useLyricsEditor } from "./useLyricsEditor";

jest.mock("../api/lyricsService", () => ({
  saveSongLyrics: jest.fn(),
  forgetSongLyrics: jest.fn(),
  fetchLyricsCandidates: jest.fn(),
}));

const mockedSave = saveSongLyrics as jest.MockedFunction<typeof saveSongLyrics>;
const mockedForget = forgetSongLyrics as jest.MockedFunction<typeof forgetSongLyrics>;
const mockedCandidates = fetchLyricsCandidates as jest.MockedFunction<typeof fetchLyricsCandidates>;

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

function candidate(id: string, text: string, startMs: number, extra: Partial<LyricsCandidate> = {}): LyricsCandidate {
  return {
    ...live,
    lines: [{ start_ms: startMs, text }],
    plain: text,
    fingerprint: id,
    stored: null,
    id,
    source_id: `record-${id}`,
    label: "",
    providers: ["lrclib"],
    durations: [],
    records: 1,
    exact_match: false,
    ends_after_video: false,
    version_mismatch: false,
    ...extra,
  };
}

const videoTimed = candidate("video", "Oh, life is bigger", 32_460, { exact_match: true });
const albumTimed = candidate("aaaa", "Oh, life", 14_530);
const syncLrc = candidate("sync", "Oh, life (SyncLRC)", 15_000, { provider: "synclrc" });

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
  latest = useLyricsEditor(song, lyrics, { enabled, durationSeconds: 294, onSaved, onForgotten });
  return (
    <>
      <div data-testid="offset">{latest.offsetMs}</div>
      <div data-testid="shown">{latest.lyrics?.lines[0]?.text}</div>
    </>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedSave.mockReset();
  mockedForget.mockReset();
  mockedCandidates.mockReset();
  mockedCandidates.mockResolvedValue({ candidates: [videoTimed, albumTimed, syncLrc], incomplete: false });
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

test("the first switch loads the candidates and shows the next one", async () => {
  render(<Harness song={song} lyrics={live} />);

  await act(async () => {
    latest.showNextCandidate();
  });

  expect(mockedCandidates).toHaveBeenCalledWith(1, 294);
  expect(screen.getByTestId("shown")).toHaveTextContent("Oh, life (SyncLRC)");
  expect(latest.candidates).toMatchObject({ status: "ready", total: 3, position: 3 });
});

test("cycling wraps around and comes back to the saved lyrics with their timing", async () => {
  render(<Harness song={song} lyrics={stored} />);

  await act(async () => {
    latest.showPreviousCandidate();
  });
  expect(screen.getByTestId("shown")).toHaveTextContent("Oh, life is bigger");
  expect(screen.getByTestId("offset")).toHaveTextContent(/^0$/);
  expect(latest.stored).toBeNull();

  act(() => latest.showNextCandidate());
  expect(screen.getByTestId("shown")).toHaveTextContent(/^Oh, life$/);
  expect(screen.getByTestId("offset")).toHaveTextContent("17000");
  expect(latest.stored?.status).toBe("verified");
});

test("keeping a previewed candidate saves it with its source record", async () => {
  render(<Harness song={song} lyrics={live} />);
  await act(async () => {
    latest.showPreviousCandidate();
  });

  await act(async () => {
    latest.keep();
  });

  expect(mockedSave).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ source_id: "record-video", lines: videoTimed.lines, offset_ms: 0 })
  );
});

test("reports when the candidates cannot be loaded", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockedCandidates.mockRejectedValueOnce(new Error("busy"));
  render(<Harness song={song} lyrics={live} />);

  await act(async () => {
    latest.showNextCandidate();
  });

  expect(latest.candidates.status).toBe("error");
  expect(screen.getByTestId("shown")).toHaveTextContent(/^Oh, life$/);
  consoleError.mockRestore();
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
