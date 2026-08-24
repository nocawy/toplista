import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSongs } from "../api/songService";
import { Song } from "../components/Song";
import { useRanking } from "../contexts/RankingContext";

const useSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  // The ranking the loaded songs belong to. Lags behind currentSlug while a
  // refetch is in flight, letting consumers detect stale data.
  const [songsSlug, setSongsSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const { currentSlug } = useRanking();
  const currentSlugRef = useRef(currentSlug);
  currentSlugRef.current = currentSlug;

  const loadSongs = useCallback(
    async (slug: string, signal?: AbortSignal, showLoading = false): Promise<Song[] | null> => {
      if (slug !== currentSlugRef.current) return null;

      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        const songsData = await fetchSongs(slug, signal);
        if (
          signal?.aborted ||
          requestSequence.current !== sequence ||
          slug !== currentSlugRef.current
        ) {
          return null;
        }
        setSongs(songsData);
        setSongsSlug(slug);
        return songsData;
      } catch (loadError) {
        if (
          signal?.aborted ||
          requestSequence.current !== sequence ||
          slug !== currentSlugRef.current
        ) {
          return null;
        }
        console.error("Error loading songs:", loadError);
        setError("Could not load ranking");
        return null;
      } finally {
        if (
          !signal?.aborted &&
          requestSequence.current === sequence &&
          slug === currentSlugRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSongs(currentSlug, controller.signal, true);
    return () => controller.abort();
  }, [currentSlug, loadSongs]);

  const refreshSongs = useCallback(
    (slug = currentSlug) => loadSongs(slug),
    [currentSlug, loadSongs]
  );

  return { songs, setSongs, songsSlug, isLoading, error, refreshSongs };
};

export default useSongs;
