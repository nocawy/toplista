import { extractYouTubeId } from "./youtube";

export function parseSongFieldInput(
  name: string,
  rawValue: string
): string | number | null {
  switch (name) {
    case "s_yt_id":
      return extractYouTubeId(rawValue);
    case "s_released":
      return rawValue === "" ? null : parseInt(rawValue, 10);
    default:
      return rawValue;
  }
}


