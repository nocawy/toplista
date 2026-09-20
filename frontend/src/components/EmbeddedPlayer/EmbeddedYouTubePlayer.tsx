import React, { useEffect, useRef } from "react";

type YouTubePlayerState = {
  ENDED: number;
  PLAYING: number;
  BUFFERING: number;
};

type YouTubePlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData?: () => { video_id?: string };
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

interface EmbeddedYouTubePlayerProps {
  videoId: string;
  onEnded: () => void;
  onPlaybackProgress?: (progress: PlaybackProgress) => void;
}

const EmbeddedYouTubePlayer: React.FC<EmbeddedYouTubePlayerProps> = ({
  videoId,
  onEnded,
  onPlaybackProgress,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const onPlaybackProgressRef = useRef(onPlaybackProgress);
  const videoIdRef = useRef(videoId);
  const swapPendingRef = useRef(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onPlaybackProgressRef.current = onPlaybackProgress;
  }, [onPlaybackProgress]);

  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;

    const reportProgress = (player: YouTubePlayer) => {
      if (swapPendingRef.current) return;
      const loadedId = readLoadedVideoId(player);
      if (loadedId && loadedId !== videoIdRef.current) return;

      onPlaybackProgressRef.current?.({
        videoId: videoIdRef.current,
        currentTime: player.getCurrentTime?.() ?? 0,
        duration: player.getDuration?.() ?? 0,
      });
    };

    // The YT API replaces the target element with an iframe. Hand it a
    // detached child element instead of the React-rendered div, otherwise
    // React crashes on unmount trying to remove a node that no longer exists.
    const playerElement = document.createElement("div");
    container?.appendChild(playerElement);

    youtubeApiReady().then(() => {
      if (!isMounted || !playerElement.isConnected) return;
      const youtubeWindow = window as YouTubeWindow;
      if (!youtubeWindow.YT?.Player) return;

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
            event.target.playVideo();
            reportProgress(event.target);
          },
          onStateChange: (event) => {
            const playerState = youtubeWindow.YT?.PlayerState;
            if (!playerState) return;

            if (event.data === playerState.ENDED) {
              const endedId = readLoadedVideoId(event.target) ?? videoIdRef.current;
              if (endedId === videoIdRef.current) {
                onEndedRef.current();
              }
              return;
            }

            if (event.data === playerState.PLAYING || event.data === playerState.BUFFERING) {
              swapPendingRef.current = false;
              reportProgress(event.target);
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
      window.clearInterval(progressTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
      container?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    const shouldLoad = player !== null && videoIdRef.current !== videoId;
    videoIdRef.current = videoId;
    if (shouldLoad && player) {
      swapPendingRef.current = true;
      player.loadVideoById(videoId);
    }
  }, [videoId]);

  return <div className="embedded-youtube-frame" ref={containerRef} />;
};

export default EmbeddedYouTubePlayer;
