"""Build progressive hint tiers from a listing payload (no price)."""

from datetime import date, datetime
from typing import Any

from app.puzzle_date import today_date

MAX_HINT_LEVEL = 4
MAX_GUESSES = 5

HINT_KEYS_BY_LEVEL: dict[int, list[str]] = {
    0: ["object_type", "city", "province"],
    1: ["living_area", "energy_label"],
    2: ["construction_year", "rooms_count"],
    3: ["bedrooms", "insulation"],
    4: ["neighbourhood", "plot_area", "house_type", "sustainability_measures"],
}

_SUSTAINABILITY_FLAGS: dict[str, str] = {
    "has_solar_panels": "Zonnepanelen",
    "has_heat_pump": "Warmtepomp",
    "is_energy_efficient": "Energiezuinig",
}


def _sustainability_measures(features: dict[str, Any]) -> list[str]:
    return [
        label
        for flag, label in _SUSTAINABILITY_FLAGS.items()
        if features.get(flag)
    ]


def _characteristic_value(listing: Any, label: str) -> str | None:
    value = listing.characteristic(label)
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.casefold() == "wat betekent dit?":
        return None
    return text


def format_listed_ago(
    publication_date: str | None,
    *,
    reference: date | None = None,
) -> str | None:
    """Human-readable time since the listing was published."""
    if not publication_date:
        return None
    try:
        published = datetime.fromisoformat(publication_date.replace("Z", "+00:00"))
    except ValueError:
        return None

    today = reference or today_date()
    published_date = published.date()
    days = (today - published_date).days
    if days < 0:
        return None
    if days == 0:
        return "Vandaag online gezet"
    if days == 1:
        return "Gisteren online gezet"
    if days < 7:
        return f"{days} dagen online"
    if days < 30:
        weeks = days // 7
        return f"{weeks} {'week' if weeks == 1 else 'weken'} online"
    if days < 365:
        months = days // 30
        return f"{months} {'maand' if months == 1 else 'maanden'} online"
    years = days // 365
    return f"{years} {'jaar' if years == 1 else 'jaar'} online"


def listing_to_payload(listing: Any) -> dict[str, Any]:
    """Serialize listing fields needed for hints (never includes answer)."""
    features = listing.property_details.features or {}
    feature_flags = [k.replace("has_", "").replace("is_", "") for k, v in features.items() if v]

    photo_urls = list(listing.media.photo_urls or ())
    return {
        "global_id": listing.global_id,
        "tiny_id": listing.tiny_id,
        "url": listing.url
        or (
            f"https://www.funda.nl{listing.detail_url}"
            if listing.detail_url and listing.detail_url.startswith("/")
            else listing.detail_url
        ),
        "detail_path": listing.detail_url or listing.urls.path,
        "offering_type": listing.offering_type,
        "object_type": listing.property_details.object_type,
        "construction_type": listing.property_details.construction_type,
        "city": listing.city,
        "province": listing.address.province,
        "municipality": listing.address.municipality,
        "neighbourhood": listing.address.neighbourhood,
        "living_area": listing.living_area,
        "plot_area": listing.plot_area,
        "energy_label": listing.energy_label,
        "bedrooms": listing.bedrooms,
        "rooms_count": listing.rooms_count,
        "construction_year": listing.property_details.construction_year,
        "house_type": listing.property_details.house_type,
        "photo_url": photo_urls[0] if photo_urls else None,
        "photo_urls": photo_urls,
        "photo_count": len(photo_urls),
        "feature_flags": feature_flags,
        "insulation": _characteristic_value(listing, "Isolatie"),
        "sustainability_measures": _sustainability_measures(features),
        "publication_date": listing.publication_date,
        "highlight": listing.highlight,
    }


def _hint_value_present(value: Any) -> bool:
    if value is None or value == "":
        return False
    if isinstance(value, list):
        return bool(value)
    return True


def hints_for_level(payload: dict[str, Any], hint_level: int) -> dict[str, Any]:
    """Return cumulative hints up to hint_level."""
    out: dict[str, Any] = {}
    for level in range(min(hint_level, MAX_HINT_LEVEL) + 1):
        for key in HINT_KEYS_BY_LEVEL.get(level, []):
            value = payload.get(key)
            if _hint_value_present(value):
                out[key] = value
    return out


def format_object_type(value: str | None) -> str:
    return {"house": "Woning", "apartment": "Appartement"}.get(value or "", value or "Onbekend")


def hints_at_level(payload: dict[str, Any], hint_level: int) -> dict[str, Any]:
    """Raw hints unlocked at a single level only."""
    out: dict[str, Any] = {}
    for key in HINT_KEYS_BY_LEVEL.get(hint_level, []):
        value = payload.get(key)
        if _hint_value_present(value):
            out[key] = value
    return out


def new_hints_for_level(
    payload: dict[str, Any], hint_level: int, guesses_count: int
) -> dict[str, Any]:
    """Hints that just appeared after the latest guess (none on initial load)."""
    if guesses_count == 0:
        return {}
    return humanize_hints(hints_at_level(payload, hint_level))


def humanize_hints(hints: dict[str, Any]) -> dict[str, Any]:
    """Add display-friendly labels for the frontend."""
    display: dict[str, Any] = {}
    if "object_type" in hints:
        display["property"] = format_object_type(hints["object_type"])
    for key in ("city", "province", "neighbourhood", "living_area", "plot_area", "energy_label"):
        if key in hints:
            display[key] = hints[key]
    if "bedrooms" in hints:
        display["bedrooms"] = hints["bedrooms"]
    if "rooms_count" in hints:
        display["rooms"] = hints["rooms_count"]
    if "construction_year" in hints:
        display["year"] = hints["construction_year"]
    if "house_type" in hints:
        display["house_type"] = hints["house_type"]
    if "insulation" in hints:
        display["insulation"] = hints["insulation"]
    measures = hints.get("sustainability_measures")
    if measures:
        display["sustainability"] = " · ".join(measures)
    return display
