import { findActiveLyricIndex } from "./lyrics";

test("findActiveLyricIndex returns the last line at or before the playhead", () => {
  const lines = [
    { start_ms: 1000, text: "one" },
    { start_ms: 4000, text: "two" },
    { start_ms: 8000, text: "three" },
  ];

  expect(findActiveLyricIndex(lines, 0)).toBe(-1);
  expect(findActiveLyricIndex(lines, 1000)).toBe(0);
  expect(findActiveLyricIndex(lines, 3999)).toBe(0);
  expect(findActiveLyricIndex(lines, 4000)).toBe(1);
  expect(findActiveLyricIndex(lines, 12000)).toBe(2);
});
