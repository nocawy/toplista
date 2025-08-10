export function extractYouTubeId(input: string): string {
  const trimmed = input.trim();

  // Already an 11-char YouTube ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (hostname === "youtu.be") {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      if (seg && /^[A-Za-z0-9_-]{11}$/.test(seg)) return seg;
    }

    // youtube.com/watch?v=<id> and other hosts
    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      // /embed/<id>, /shorts/<id>, /v/<id>
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^[A-Za-z0-9_-]{11}$/.test(last)) return last;
    }

    // Fallback: detect v= in arbitrary text
    const vInText = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (vInText) return vInText[1];
  } catch {
    // not a URL
  }

  return trimmed;
}


