import { act, cleanup, render } from "@testing-library/react";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";

type PlayerInstance = {
  videoId: string;
  playlist: string[] | null;
  playlistIndex: number;
  currentTime: number;
  duration: number;
  loadVideoById: jest.Mock;
  loadPlaylist: jest.Mock;
  stopVideo: jest.Mock;
  playVideo: jest.Mock;
  destroy: jest.Mock;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData: () => { video_id: string };
  getPlaylist: () => string[] | null;
  getPlaylistIndex: () => number;
  emitState: (state: number) => void;
  completeLoad: (videoId: string) => void;
  completePlaylistLoad: (playlist: string[], index: number) => void;
};

const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
};

let instances: PlayerInstance[];

function installYouTubeApi() {
  instances = [];

  function Player(this: PlayerInstance, _element: HTMLElement, options: {
    videoId: string;
    events?: {
      onReady?: (event: { target: PlayerInstance }) => void;
      onStateChange?: (event: { data: number; target: PlayerInstance }) => void;
    };
  }) {
    const instance = this;
    instance.videoId = options.videoId;
    instance.playlist = null;
    instance.playlistIndex = -1;
    instance.currentTime = 0;
    instance.duration = 180;
    instance.loadVideoById = jest.fn((videoId: string) => {
      instance.videoId = videoId;
      instance.playlist = null;
      instance.playlistIndex = -1;
    });
    instance.loadPlaylist = jest.fn((playlist: string[], index = 0) => {
      instance.playlist = [...playlist];
      instance.playlistIndex = index;
      instance.videoId = playlist[index] ?? instance.videoId;
    });
    instance.stopVideo = jest.fn();
    instance.playVideo = jest.fn();
    instance.destroy = jest.fn();
    instance.getCurrentTime = () => instance.currentTime;
    instance.getDuration = () => instance.duration;
    instance.getPlayerState = () => PlayerState.PLAYING;
    instance.getVideoData = () => ({ video_id: instance.videoId });
    instance.getPlaylist = () => instance.playlist;
    instance.getPlaylistIndex = () => instance.playlistIndex;
    instance.emitState = (state: number) => {
      options.events?.onStateChange?.({ data: state, target: instance });
    };
    instance.completeLoad = (videoId: string) => {
      instance.videoId = videoId;
      instance.currentTime = 0;
      instance.duration = 200;
      instance.emitState(PlayerState.BUFFERING);
      instance.emitState(PlayerState.PLAYING);
    };
    instance.completePlaylistLoad = (playlist: string[], index: number) => {
      instance.playlist = [...playlist];
      instance.playlistIndex = index;
      instance.videoId = playlist[index] ?? instance.videoId;
      instance.currentTime = 0;
      instance.duration = 200;
      instance.emitState(PlayerState.UNSTARTED);
      instance.emitState(PlayerState.BUFFERING);
      instance.emitState(PlayerState.PLAYING);
    };
    instances.push(instance);
    options.events?.onReady?.({ target: instance });
  }

  (window as unknown as { YT: unknown }).YT = {
    Player,
    PlayerState,
  };
}

async function flushPlayer() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  installYouTubeApi();
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  delete (window as unknown as { YT?: unknown }).YT;
});

test("reuses the iframe and loads the next video without remounting", async () => {
  const { rerender } = render(
    <EmbeddedYouTubePlayer videoId="videoAAAAAAA" onEnded={jest.fn()} />
  );
  await flushPlayer();

  expect(instances).toHaveLength(1);
  const player = instances[0];

  rerender(<EmbeddedYouTubePlayer videoId="videoBBBBBBB" onEnded={jest.fn()} />);
  await flushPlayer();

  expect(instances).toHaveLength(1);
  expect(player.destroy).not.toHaveBeenCalled();
  expect(player.loadVideoById).toHaveBeenCalledWith("videoBBBBBBB");
});

test("does not apply the previous video's clock to the next song's lyrics", async () => {
  const onPlaybackProgress = jest.fn();
  const { rerender } = render(
    <EmbeddedYouTubePlayer
      videoId="videoAAAAAAA"
      onEnded={jest.fn()}
      onPlaybackProgress={onPlaybackProgress}
    />
  );
  await flushPlayer();

  const player = instances[0];
  player.currentTime = 175;
  onPlaybackProgress.mockClear();

  player.loadVideoById.mockImplementation(() => {
    // YouTube still reports the old video until the new one actually loads.
  });

  rerender(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      onEnded={jest.fn()}
      onPlaybackProgress={onPlaybackProgress}
    />
  );
  await flushPlayer();

  act(() => {
    jest.advanceTimersByTime(500);
  });

  expect(onPlaybackProgress).not.toHaveBeenCalled();

  act(() => {
    player.completeLoad("videoBBBBBBB");
  });

  expect(onPlaybackProgress).toHaveBeenCalledWith({
    videoId: "videoBBBBBBB",
    currentTime: 0,
    duration: 200,
  });
});

test("ignores ENDED from a video that is no longer the requested track", async () => {
  const onEnded = jest.fn();
  const { rerender } = render(
    <EmbeddedYouTubePlayer videoId="videoAAAAAAA" onEnded={onEnded} />
  );
  await flushPlayer();

  const player = instances[0];
  player.loadVideoById.mockImplementation(() => {
    // Keep reporting the ended video until the replacement starts.
  });

  rerender(<EmbeddedYouTubePlayer videoId="videoBBBBBBB" onEnded={onEnded} />);
  await flushPlayer();

  act(() => {
    player.emitState(PlayerState.ENDED);
  });

  expect(onEnded).not.toHaveBeenCalled();
});

test("advances the queue when the current video ends", async () => {
  const onEnded = jest.fn();
  render(<EmbeddedYouTubePlayer videoId="videoAAAAAAA" onEnded={onEnded} />);
  await flushPlayer();

  act(() => {
    instances[0].emitState(PlayerState.ENDED);
  });

  expect(onEnded).toHaveBeenCalledTimes(1);
});

test("loads a 3-slot playlist centered at index 1 when previous and next exist", async () => {
  render(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
      onNext={jest.fn()}
      onPrevious={jest.fn()}
    />
  );
  await flushPlayer();

  expect(instances[0].loadPlaylist).toHaveBeenCalledWith(
    ["videoBBBBBBB", "videoBBBBBBB", "videoBBBBBBB"],
    1
  );
});

test("omits missing boundary slot at the start or end of the queue", async () => {
  const { unmount } = render(
    <EmbeddedYouTubePlayer
      videoId="videoAAAAAAA"
      canGoPrevious={false}
      canGoNext
      onEnded={jest.fn()}
      onNext={jest.fn()}
    />
  );
  await flushPlayer();

  expect(instances[0].loadPlaylist).toHaveBeenCalledWith(["videoAAAAAAA", "videoAAAAAAA"], 0);
  unmount();

  render(
    <EmbeddedYouTubePlayer
      videoId="videoCCCCCCC"
      canGoPrevious
      canGoNext={false}
      onEnded={jest.fn()}
      onPrevious={jest.fn()}
    />
  );
  await flushPlayer();

  expect(instances[1].loadPlaylist).toHaveBeenCalledWith(["videoCCCCCCC", "videoCCCCCCC"], 1);
});

test("dispatches onNext/onPrevious once when YouTube shifts playlist index and reloads the window", async () => {
  const onNext = jest.fn();
  const onPrevious = jest.fn();
  const { rerender } = render(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      trackKey={2}
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  );
  await flushPlayer();

  const player = instances[0];
  act(() => {
    player.completePlaylistLoad(["videoBBBBBBB", "videoBBBBBBB", "videoBBBBBBB"], 1);
  });

  // Simulate OS media Next jumping to index 2 across multiple state events.
  act(() => {
    player.playlistIndex = 2;
    player.emitState(PlayerState.PAUSED);
    player.emitState(PlayerState.UNSTARTED);
    player.emitState(PlayerState.BUFFERING);
  });

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onPrevious).not.toHaveBeenCalled();

  rerender(
    <EmbeddedYouTubePlayer
      videoId="videoCCCCCCC"
      trackKey={3}
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  );
  await flushPlayer();

  expect(player.stopVideo).toHaveBeenCalledTimes(1);
  expect(player.loadPlaylist).toHaveBeenLastCalledWith(
    ["videoCCCCCCC", "videoCCCCCCC", "videoCCCCCCC"],
    1
  );

  act(() => {
    player.completePlaylistLoad(["videoCCCCCCC", "videoCCCCCCC", "videoCCCCCCC"], 1);
  });

  // Simulate OS media Previous jumping to index 0.
  act(() => {
    player.playlistIndex = 0;
    player.emitState(PlayerState.PAUSED);
  });

  expect(onPrevious).toHaveBeenCalledTimes(1);
});

test("does not interrupt playback on boundary change and snaps back if navigation becomes unavailable", async () => {
  const onPrevious = jest.fn();
  const { rerender } = render(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      trackKey={2}
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
      onPrevious={onPrevious}
    />
  );
  await flushPlayer();

  const player = instances[0];
  act(() => {
    player.completePlaylistLoad(["videoBBBBBBB", "videoBBBBBBB", "videoBBBBBBB"], 1);
  });
  player.loadPlaylist.mockClear();

  // Song is dragged to rank #1 while playing: must not reload mid-song.
  rerender(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      trackKey={2}
      canGoPrevious={false}
      canGoNext
      onEnded={jest.fn()}
      onPrevious={onPrevious}
    />
  );
  await flushPlayer();

  expect(player.loadPlaylist).not.toHaveBeenCalled();

  // Pressing Previous now refreshes the window to [B, B] @ 0 instead of calling onPrevious.
  act(() => {
    player.playlistIndex = 0;
    player.emitState(PlayerState.PAUSED);
  });

  expect(onPrevious).not.toHaveBeenCalled();
  expect(player.loadPlaylist).toHaveBeenCalledWith(["videoBBBBBBB", "videoBBBBBBB"], 0);
});

test("does not double-advance when ENDED is followed by playlist index advance", async () => {
  const onEnded = jest.fn();
  const onNext = jest.fn();
  render(
    <EmbeddedYouTubePlayer
      videoId="videoBBBBBBB"
      canGoPrevious
      canGoNext
      onEnded={onEnded}
      onNext={onNext}
    />
  );
  await flushPlayer();

  const player = instances[0];
  act(() => {
    player.completePlaylistLoad(["videoBBBBBBB", "videoBBBBBBB", "videoBBBBBBB"], 1);
  });

  act(() => {
    player.emitState(PlayerState.ENDED);
    player.playlistIndex = 2;
    player.emitState(PlayerState.UNSTARTED);
  });

  expect(onEnded).toHaveBeenCalledTimes(1);
  expect(onNext).not.toHaveBeenCalled();
});

test("reloads when trackKey changes even if two adjacent songs share a videoId", async () => {
  const { rerender } = render(
    <EmbeddedYouTubePlayer
      videoId="videoAAAAAAA"
      trackKey={10}
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
    />
  );
  await flushPlayer();

  const player = instances[0];
  player.loadPlaylist.mockClear();

  rerender(
    <EmbeddedYouTubePlayer
      videoId="videoAAAAAAA"
      trackKey={11}
      canGoPrevious
      canGoNext
      onEnded={jest.fn()}
    />
  );
  await flushPlayer();

  expect(player.loadPlaylist).toHaveBeenCalledWith(
    ["videoAAAAAAA", "videoAAAAAAA", "videoAAAAAAA"],
    1
  );
});
