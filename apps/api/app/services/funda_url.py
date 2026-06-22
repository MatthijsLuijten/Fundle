"""Resolve public Funda listing URLs from stored payload fields."""

from typing import Any


def funda_listing_url(payload: dict[str, Any]) -> str | None:
    """Return a working www.funda.nl detail URL."""
    url = payload.get("url")
    if isinstance(url, str) and "funda.nl/detail/" in url:
        return url.split("?")[0].split("#")[0]

    path = payload.get("detail_path")
    if isinstance(path, str) and path.startswith("/detail/"):
        return f"https://www.funda.nl{path.split('?')[0].split('#')[0]}"

    return None
