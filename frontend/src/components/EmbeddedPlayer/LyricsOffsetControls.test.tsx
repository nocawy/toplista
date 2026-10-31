import { fireEvent, render, screen } from "@testing-library/react";
import LyricsOffsetControls, { formatLyricsOffset } from "./LyricsOffsetControls";

test("nudges the lyrics earlier and later", () => {
  const onAdjust = jest.fn();
  render(<LyricsOffsetControls offsetMs={17_000} onAdjust={onAdjust} onReset={jest.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Show lyrics 5 s earlier" }));
  fireEvent.click(screen.getByRole("button", { name: "Show lyrics 0.5 s later" }));

  expect(onAdjust.mock.calls).toEqual([[-5_000], [500]]);
});

test("resets a non-zero offset", () => {
  const onReset = jest.fn();
  const { rerender } = render(
    <LyricsOffsetControls offsetMs={0} onAdjust={jest.fn()} onReset={onReset} />
  );
  expect(screen.getByRole("button", { name: /Lyrics timing/ })).toBeDisabled();

  rerender(<LyricsOffsetControls offsetMs={-1_500} onAdjust={jest.fn()} onReset={onReset} />);
  fireEvent.click(screen.getByRole("button", { name: "Lyrics timing −1.5 s, reset" }));

  expect(onReset).toHaveBeenCalledTimes(1);
});

test("formats offsets with an explicit sign", () => {
  expect(formatLyricsOffset(17_000)).toBe("+17.0 s");
  expect(formatLyricsOffset(-500)).toBe("−0.5 s");
  expect(formatLyricsOffset(0)).toBe("±0.0 s");
});
