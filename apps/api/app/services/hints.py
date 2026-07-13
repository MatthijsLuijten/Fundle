"""Serialize a Funda listing into the puzzle payload stored in Supabase.

The payload holds every field the client engine (apps/web/lib/engine.ts) later
reveals as progressive hints — but never the answer price. The hint-tiering and
display logic lives only on the TS side now; this module just produces the raw
fields it consumes.
"""

from typing import Any

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
