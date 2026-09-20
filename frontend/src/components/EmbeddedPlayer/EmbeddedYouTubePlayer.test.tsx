import { act, cleanup, render } from "@testing-library/react";
import EmbeddedYouTubePlayer from "./EmbeddedYouTubePlayer";

type PlayerInstance = {
  videoId: string;
  currentTime: number;
  duration: number;
  loadVideoById: jest.Mock;
  playVideo: jest.Mock;
  destroy: jest.Mock;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData: () => { video_id: string };
  emitState: (state: number) => void;
  completeLoad: (videoId: string) => void;
};

const PlayerState = {
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
    instance.currentTime = 0;
    instance.duration = 180;
    instance.loadVideoById = jest.fn((videoId: string) => {
      instance.videoId = videoId;
    });
    instance.playVideo = jest.fn();
    instance.destroy = jest.fn();
    instance.getCurrentTime = () => instance.currentTime;
    instance.getDuration = () => instance.duration;
    instance.getPlayerState = () => PlayerState.PLAYING;
    instance.getVideoData = () => ({ video_id: instance.videoId });
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
