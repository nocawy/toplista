from __future__ import annotations

from rest_framework import serializers

from ..models import SongLyrics
from .service import result_to_payload
from .types import LyricLine, LyricsResult

MAX_OFFSET_MS = 5 * 60 * 1000


class StoredLyricLineSerializer(serializers.Serializer):
    start_ms = serializers.IntegerField(min_value=0, max_value=6 * 60 * 60 * 1000)
    text = serializers.CharField(max_length=500)


class StoredLyricsSerializer(serializers.ModelSerializer):
    lines = serializers.ListField(child=StoredLyricLineSerializer(), max_length=2000, required=False)
    plain = serializers.CharField(max_length=50_000, required=False, allow_null=True, allow_blank=True)
    offset_ms = serializers.IntegerField(min_value=-MAX_OFFSET_MS, max_value=MAX_OFFSET_MS, required=False)

    class Meta:
        model = SongLyrics
        fields = ["provider", "source_id", "instrumental", "lines", "plain", "offset_ms", "status"]

    def validate(self, data):
        # PUT replaces the stored lyrics completely, so omitted fields reset.
        data.setdefault("source_id", "")
        data.setdefault("instrumental", False)
        data.setdefault("offset_ms", 0)
        data.setdefault("status", SongLyrics.MANUAL)
        lines = sorted(data.get("lines") or [], key=lambda line: line["start_ms"])
        data["lines"] = [{"start_ms": line["start_ms"], "text": line["text"]} for line in lines]
        plain = (data.get("plain") or "").strip()
        if not (data.get("instrumental") or data["lines"] or plain):
            raise serializers.ValidationError("Lyrics need lines, plain text or the instrumental flag.")
        data["plain"] = plain or "\n".join(line["text"] for line in data["lines"]) or None
        return data


def stored_to_payload(stored: SongLyrics) -> dict:
    lines = [LyricLine(start_ms=int(line["start_ms"]), text=str(line["text"])) for line in stored.lines]
    result = LyricsResult(
        provider=stored.provider,
        instrumental=stored.instrumental,
        synced=bool(lines) and not stored.instrumental,
        lines=lines,
        plain=stored.plain,
    )
    return {
        **result_to_payload(result),
        "stored": {
            "status": stored.status,
            "offset_ms": stored.offset_ms,
            "source_id": stored.source_id,
            "updated_on": stored.updated_on.isoformat(),
        },
    }
