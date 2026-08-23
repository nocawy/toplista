export interface LyricsLine {
  start_ms: number;
  text: string;
}

export function findActiveLyricIndex(lines: LyricsLine[], timeMs: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].start_ms <= timeMs) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}
