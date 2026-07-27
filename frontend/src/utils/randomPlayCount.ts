import { getStorageItem, setStorageItem } from "./appStorage";

const STORAGE_PREFIX = "randomPlayCount:";
export const DEFAULT_RANDOM_PLAY_COUNT = 50;

export function getRandomPlayCount(slug: string): number {
  const stored = getStorageItem(`${STORAGE_PREFIX}${slug}`);
  if (!stored) return DEFAULT_RANDOM_PLAY_COUNT;

  const parsed = parseInt(stored, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RANDOM_PLAY_COUNT;
  return parsed;
}

export function setRandomPlayCount(slug: string, count: number): void {
  setStorageItem(`${STORAGE_PREFIX}${slug}`, String(count));
}

export function clampRandomPlayCount(count: number, songCount: number): number {
  if (songCount <= 0) return 1;
  return Math.min(Math.max(1, count), songCount);
}
