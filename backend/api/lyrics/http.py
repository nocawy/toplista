from __future__ import annotations

import json
import logging
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 502, 503, 504}


class ProviderUnavailable(Exception):
    """The provider could not answer right now; absence of lyrics is not known."""


def user_agent() -> str:
    return getattr(settings, "LYRICS_USER_AGENT", "Toplista/1.0 (https://nocawy.pl/toplista/)")


def timeout_seconds() -> float:
    return float(getattr(settings, "LYRICS_HTTP_TIMEOUT", 8))


def max_response_bytes() -> int:
    return int(getattr(settings, "LYRICS_MAX_RESPONSE_BYTES", 1024 * 1024))


def retries() -> int:
    return int(getattr(settings, "LYRICS_HTTP_RETRIES", 1))


def retry_delay_seconds() -> float:
    return float(getattr(settings, "LYRICS_HTTP_RETRY_DELAY", 0.5))


def get_json(url: str, extra_headers: dict[str, str] | None = None) -> Any | None:
    """GET JSON from a lyrics provider.

    Returns None when the provider definitively has nothing (404 and other client
    errors, oversized responses). Raises ProviderUnavailable for overload, server
    errors, network failures and timeouts, after retrying fast failures.
    """
    attempts = 1 + max(0, retries())
    for attempt in range(1, attempts + 1):
        try:
            return _get_json_once(url, extra_headers)
        except HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code not in RETRYABLE_STATUS_CODES and exc.code < 500:
                logger.info("lyrics HTTP %s for %s", exc.code, url)
                return None
            if exc.code in RETRYABLE_STATUS_CODES and attempt < attempts:
                time.sleep(retry_delay_seconds())
                continue
            raise ProviderUnavailable(f"HTTP {exc.code}") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise ProviderUnavailable(str(exc)) from exc
    raise ProviderUnavailable("no attempts made")


def _get_json_once(url: str, extra_headers: dict[str, str] | None) -> Any | None:
    headers = {
        "User-Agent": user_agent(),
        "X-User-Agent": user_agent(),
        "Lrclib-Client": user_agent(),
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    request = Request(url, headers=headers)
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

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ProviderUnavailable("response was not JSON") from exc
