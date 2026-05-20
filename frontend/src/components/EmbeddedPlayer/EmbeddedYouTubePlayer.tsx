import React, { useEffect, useRef } from "react";

type YouTubePlayerState = {
  ENDED: number;
};

type YouTubePlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number }) => void;
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

interface EmbeddedYouTubePlayerProps {
  videoId: string;
  onEnded: () => void;
}

const EmbeddedYouTubePlayer: React.FC<EmbeddedYouTubePlayerProps> = ({ videoId, onEnded }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const videoIdRef = useRef(videoId);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    let isMounted = true;

    youtubeApiReady().then(() => {
      if (!isMounted || !containerRef.current) return;
      const youtubeWindow = window as YouTubeWindow;
      if (!youtubeWindow.YT?.Player) return;

      playerRef.current = new youtubeWindow.YT.Player(containerRef.current, {
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
          },
          onStateChange: (event) => {
            if (event.data === youtubeWindow.YT?.PlayerState.ENDED) {
              onEndedRef.current();
            }
          },
        },
      });
    });

    return () => {
      isMounted = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  return <div className="embedded-youtube-frame" ref={containerRef} />;
};

export default EmbeddedYouTubePlayer;
