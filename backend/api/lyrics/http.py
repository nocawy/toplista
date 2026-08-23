from __future__ import annotations

import json
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


def user_agent() -> str:
    return getattr(settings, "LYRICS_USER_AGENT", "Toplista/1.0 (https://nocawy.pl/toplista/)")


def timeout_seconds() -> float:
    return float(getattr(settings, "LYRICS_HTTP_TIMEOUT", 8))


def max_response_bytes() -> int:
    return int(getattr(settings, "LYRICS_MAX_RESPONSE_BYTES", 1024 * 1024))


def get_json(url: str, extra_headers: dict[str, str] | None = None) -> Any | None:
    """GET JSON from a lyrics provider. 404 and network errors return None."""
    headers = {
        "User-Agent": user_agent(),
        "X-User-Agent": user_agent(),
        "Lrclib-Client": user_agent(),
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=timeout_seconds()) as response:
            limit = max_response_bytes()
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    if int(content_length) > limit:
                        logger.info("lyrics response was too large for %s", url)
                        return None
                except ValueError:
                    pass

            body = response.read(limit + 1)
            if len(body) > limit:
                logger.info("lyrics response was too large for %s", url)
                return None
            raw = body.decode("utf-8")
    except HTTPError as exc:
        if exc.code != 404:
            logger.info("lyrics HTTP %s for %s", exc.code, url)
        return None
    except (URLError, TimeoutError, OSError) as exc:
        logger.info("lyrics request failed for %s: %s", url, exc)
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.info("lyrics response was not JSON for %s", url)
        return None
