import React, { useEffect, useRef } from "react";

type YouTubePlayerState = {
  UNSTARTED?: number;
  ENDED: number;
  PLAYING: number;
  PAUSED?: number;
  BUFFERING: number;
  CUED?: number;
};

type YouTubePlayer = {
  loadVideoById: (videoId: string) => void;
  loadPlaylist?: (playlist: string[], index?: number, startSeconds?: number) => void;
  stopVideo?: () => void;
  playVideo: () => void;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData?: () => { video_id?: string };
  getPlaylist?: () => string[] | null;
  getPlaylistIndex?: () => number;
};

export type PlaybackProgress = {
  videoId: string;
  currentTime: number;
  duration: number;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      onError?: () => void;
    };
  }
) => YouTubePlayer;

type YouTubeWindow = Window & {
  YT?: {
    Player: YouTubePlayerConstructor;
    PlayerState: YouTubePlayerState;
  };
  onYouTubeIframeAPIReady?: () => void;
};

const youtubeApiReady = (() => {
  let promise: Promise<void> | null = null;

  return () => {
    const youtubeWindow = window as YouTubeWindow;
    if (youtubeWindow.YT?.Player) {
      return Promise.resolve();
    }

    if (!promise) {
      promise = new Promise<void>((resolve) => {
        const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
        youtubeWindow.onYouTubeIframeAPIReady = () => {
          previousReady?.();
          resolve();
        };

        if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
          const script = document.createElement("script");
          script.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(script);
        }
      });
    }

    return promise;
  };
})();

function readLoadedVideoId(player: YouTubePlayer): string | null {
  try {
    return player.getVideoData?.()?.video_id ?? null;
  } catch {
    return null;
  }
}

function readPlaylist(player: YouTubePlayer): string[] | null {
  try {
    const playlist = player.getPlaylist?.();
    return Array.isArray(playlist) ? playlist : null;
  } catch {
    return null;
  }
}

function readPlaylistIndex(player: YouTubePlayer): number | null {
  try {
    const index = player.getPlaylistIndex?.();
    return typeof index === "number" && index >= 0 ? index : null;
  } catch {
    return null;
  }
}

function playlistsEqual(actual: string[] | null, expected: string[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

type PlaylistWindow = {
  playlist: string[];
  currentIndex: number;
  videoId: string;
};

// Build a 1-to-3 item playlist repeating the current video ID as prev/next
// tripwire slots. Repeating the current video avoids two YouTube API pitfalls:
// 1. Deleted/unavailable neighbor IDs get stripped by YouTube before `index`
//    is applied, shifting the playlist and playing the wrong song.
// 2. Reordering the ranking never leaves stale neighbor video IDs in the
//    player; jumping to index 0 or 2 simply signals previous/next to React.
function buildPlaylistWindow(
  videoId: string,
  canGoPrevious: boolean,
  canGoNext: boolean
): PlaylistWindow {
  const playlist: string[] = [];
  if (canGoPrevious) {
    playlist.push(videoId);
  }
  const currentIndex = playlist.length;
  playlist.push(videoId);
  if (canGoNext) {
    playlist.push(videoId);
  }
  return { playlist, currentIndex, videoId };
}

function isPlayerAtWindow(player: YouTubePlayer, expected: PlaylistWindow): boolean {
  const loadedId = readLoadedVideoId(player);
  if (loadedId && loadedId !== expected.videoId) {
    return false;
  }
  if (expected.playlist.length > 1 && typeof player.loadPlaylist === "function") {
    const playlist = readPlaylist(player);
    const index = readPlaylistIndex(player);
    if (!playlistsEqual(playlist, expected.playlist)) {
      return false;
    }
    if (index !== expected.currentIndex) {
      return false;
    }
  }
  return true;
}

interface EmbeddedYouTubePlayerProps {
  videoId: string;
  trackKey?: string | number;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onEnded: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onPlaybackProgress?: (progress: PlaybackProgress) => void;
}

const EmbeddedYouTubePlayer: React.FC<EmbeddedYouTubePlayerProps> = ({
  videoId,
  trackKey,
  canGoPrevious = false,
  canGoNext = false,
  onEnded,
  onNext,
  onPrevious,
  onPlaybackProgress,
}) => {
  const resolvedTrackKey = trackKey ?? videoId;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerReadyRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const onPlaybackProgressRef = useRef(onPlaybackProgress);
  const videoIdRef = useRef(videoId);
  const trackKeyRef = useRef<string | number>(resolvedTrackKey);
  const canGoPreviousRef = useRef(canGoPrevious);
  const canGoNextRef = useRef(canGoNext);
  const expectedWindowRef = useRef<PlaylistWindow>(
    buildPlaylistWindow(videoId, canGoPrevious, canGoNext)
  );
  const swapPendingRef = useRef(false);
  const navigationDispatchedRef = useRef(false);
  const loadWindowRef = useRef<
    (player: YouTubePlayer, target: PlaylistWindow, isInitialReady: boolean) => void
  >(() => {});

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    onPreviousRef.current = onPrevious;
  }, [onPrevious]);

  useEffect(() => {
    onPlaybackProgressRef.current = onPlaybackProgress;
  }, [onPlaybackProgress]);

  // Keep boundary flags fresh without reloading the playing video when the
  // user reorders songs in the ranking.
  canGoPreviousRef.current = canGoPrevious;
  canGoNextRef.current = canGoNext;

  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;

    const reportProgress = (player: YouTubePlayer) => {
      if (swapPendingRef.current || navigationDispatchedRef.current) return;
      const expected = expectedWindowRef.current;
      if (!isPlayerAtWindow(player, expected)) return;

      onPlaybackProgressRef.current?.({
        videoId: expected.videoId,
        currentTime: player.getCurrentTime?.() ?? 0,
        duration: player.getDuration?.() ?? 0,
      });
    };

    const loadWindow = (
      player: YouTubePlayer,
      target: PlaylistWindow,
      isInitialReady: boolean
    ) => {
      expectedWindowRef.current = target;
      navigationDispatchedRef.current = false;

      if (target.playlist.length > 1 && player.loadPlaylist) {
        swapPendingRef.current = true;
        if (!isInitialReady) {
          // Stop the outgoing video first so if YouTube rejects the new
          // playlist (e.g. a deleted video ID), old audio does not keep playing.
          player.stopVideo?.();
        }
        player.loadPlaylist(target.playlist, target.currentIndex);
        return;
      }

      if (isInitialReady) {
        const loadedId = readLoadedVideoId(player);
        if (loadedId && loadedId !== target.videoId) {
          swapPendingRef.current = true;
          player.loadVideoById(target.videoId);
          return;
        }
        swapPendingRef.current = false;
        player.playVideo();
        reportProgress(player);
        return;
      }

      swapPendingRef.current = true;
      player.loadVideoById(target.videoId);
    };

    loadWindowRef.current = loadWindow;

    // The YT API replaces the target element with an iframe. Hand it a
    // detached child element instead of the React-rendered div, otherwise
    // React crashes on unmount trying to remove a node that no longer exists.
    const playerElement = document.createElement("div");
    container?.appendChild(playerElement);

    youtubeApiReady().then(() => {
      if (!isMounted || !playerElement.isConnected) return;
      const youtubeWindow = window as YouTubeWindow;
      if (!youtubeWindow.YT?.Player) return;

      playerReadyRef.current = false;
      playerRef.current = new youtubeWindow.YT.Player(playerElement, {
        videoId: videoIdRef.current,
        playerVars: {
          autoplay: 1,
          controls: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            const initialWindow = buildPlaylistWindow(
              videoIdRef.current,
              canGoPreviousRef.current,
              canGoNextRef.current
            );
            loadWindow(event.target, initialWindow, true);
          },
          onStateChange: (event) => {
            const playerState = youtubeWindow.YT?.PlayerState;
            if (!playerState) return;

            const player = event.target;
            const expected = expectedWindowRef.current;
            const isPlaylistMode =
              expected.playlist.length > 1 && typeof player.loadPlaylist === "function";

            if (swapPendingRef.current) {
              if (
                (event.data === playerState.PLAYING || event.data === playerState.BUFFERING) &&
                isPlayerAtWindow(player, expected)
              ) {
                swapPendingRef.current = false;
                reportProgress(player);
              }
              return;
            }

            if (navigationDispatchedRef.current) {
              return;
            }

            if (event.data === playerState.ENDED) {
              const endedId = readLoadedVideoId(player) ?? expected.videoId;
              const endedIndex = isPlaylistMode ? readPlaylistIndex(player) : null;
              const indexMatches = endedIndex === null || endedIndex === expected.currentIndex;
              if (endedId === expected.videoId && indexMatches) {
                navigationDispatchedRef.current = true;
                onEndedRef.current();
              }
              return;
            }

            if (isPlaylistMode) {
              const playlist = readPlaylist(player);
              const index = readPlaylistIndex(player);
              if (
                playlistsEqual(playlist, expected.playlist) &&
                index !== null &&
                index !== expected.currentIndex
              ) {
                if (index > expected.currentIndex) {
                  if (canGoNextRef.current && onNextRef.current) {
                    navigationDispatchedRef.current = true;
                    onNextRef.current();
                  } else {
                    loadWindow(
                      player,
                      buildPlaylistWindow(
                        expected.videoId,
                        canGoPreviousRef.current,
                        canGoNextRef.current
                      ),
                      false
                    );
                  }
                  return;
                }

                if (index < expected.currentIndex) {
                  if (canGoPreviousRef.current && onPreviousRef.current) {
                    navigationDispatchedRef.current = true;
                    onPreviousRef.current();
                  } else {
                    loadWindow(
                      player,
                      buildPlaylistWindow(
                        expected.videoId,
                        canGoPreviousRef.current,
                        canGoNextRef.current
                      ),
                      false
                    );
                  }
                  return;
                }
              }
            }

            if (event.data === playerState.PLAYING || event.data === playerState.BUFFERING) {
              reportProgress(player);
            }
          },
          onError: () => {
            swapPendingRef.current = false;
          },
        },
      });
    });

    const progressTimer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      try {
        reportProgress(player);
      } catch {
        // Player can throw while a video is still swapping.
      }
    }, 250);

    return () => {
      isMounted = false;
      playerReadyRef.current = false;
      window.clearInterval(progressTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
      container?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    const trackChanged =
      trackKeyRef.current !== resolvedTrackKey || videoIdRef.current !== videoId;
    const shouldLoad = player !== null && playerReadyRef.current && trackChanged;
    trackKeyRef.current = resolvedTrackKey;
    videoIdRef.current = videoId;
    if (shouldLoad && player) {
      const targetWindow = buildPlaylistWindow(
        videoId,
        canGoPreviousRef.current,
        canGoNextRef.current
      );
      loadWindowRef.current(player, targetWindow, false);
    }
  }, [resolvedTrackKey, videoId]);

  return <div className="embedded-youtube-frame" ref={containerRef} />;
};

export default EmbeddedYouTubePlayer;
