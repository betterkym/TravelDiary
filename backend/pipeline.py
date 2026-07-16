from __future__ import annotations

from pathlib import Path

from . import config, storage
from .models import Diary
from .services import dedupe, diary, location, quality, route, selector, timeline


def generate(trip_id: str) -> Diary:
    """Generate a diary summary from stored GPS points and photos."""
    photos = storage.get_photos(trip_id)
    trip_route = route.build_route_from_photos(photos)

    if trip_route is None:
        raw_points = storage.get_locations(trip_id)
        clean_points = location.clean(raw_points)
        trip_route = route.build_route(clean_points)

    paths: dict[str, Path] = {p.photo_id: config.UPLOAD_DIR / p.filename for p in photos}
    for p in photos:
        quality.score(p, paths[p.photo_id])
    photos = dedupe.group(photos, paths)
    feedback = storage.get_photo_feedback(trip_id)
    learned_profile = storage.get_preference_profile()
    feedback_profile = _build_preference_profile(photos, feedback)
    preference_profile = _merge_preference_profiles(learned_profile, feedback_profile)
    selected = selector.select(photos, preference_profile=preference_profile)

    entries = timeline.build(trip_route, selected, photos)
    entries = diary.annotate(entries)
    region = storage.get_meta(trip_id).get("region", "")
    title = diary.make_title(entries, region=region)

    result = Diary(
        trip_id=trip_id,
        title=title,
        route=trip_route,
        selected_photos=selected,
        timeline=entries,
    )
    storage.save_diary(trip_id, result)
    return result


def _build_preference_profile(photos, feedback):
    if feedback is None:
        return None

    accepted = {photo.photo_id for photo in photos if photo.photo_id in set(feedback.accepted_photo_ids)}
    rejected = {photo.photo_id for photo in photos if photo.photo_id in set(feedback.rejected_photo_ids)}

    if not accepted and not rejected:
        return None

    accepted_photos = [p for p in photos if p.photo_id in accepted]
    rejected_photos = [p for p in photos if p.photo_id in rejected]

    def avg(attr: str, items):
        values = [getattr(p, attr) for p in items if getattr(p, attr) is not None]
        return sum(values) / len(values) if values else 0.0

    accepted_quality = avg("quality_score", accepted_photos)
    accepted_composition = avg("composition_score", accepted_photos)
    accepted_face = avg("face_hint_score", accepted_photos)
    rejected_quality = avg("quality_score", rejected_photos)
    rejected_composition = avg("composition_score", rejected_photos)
    rejected_face = avg("face_hint_score", rejected_photos)

    return {
        "quality_boost": max(0.0, accepted_quality - rejected_quality),
        "composition_boost": max(0.0, accepted_composition - rejected_composition),
        "face_boost": max(0.0, accepted_face - rejected_face),
        "resolution_boost": 0.15 if accepted_photos else 0.0,
        "person_boost": _theme_boost(accepted_photos, rejected_photos, "person"),
        "landscape_boost": _theme_boost(accepted_photos, rejected_photos, "landscape"),
        "food_boost": _theme_boost(accepted_photos, rejected_photos, "food"),
    }


def _merge_preference_profiles(learned_profile, feedback_profile):
    if not learned_profile and not feedback_profile:
        return None

    weights = (learned_profile or {}).get("weights", {})
    merged = {
        "quality_boost": float(weights.get("quality_score", 0.0)),
        "composition_boost": float(weights.get("composition_score", 0.0)),
        "face_boost": float(weights.get("face_hint_score", 0.0)),
        "resolution_boost": float(weights.get("resolution_score", 0.0)),
        "exposure_boost": float(weights.get("exposure_score", 0.0)),
        "backlight_boost": float(weights.get("backlight_score", 0.0)),
        "saturation_boost": float(weights.get("saturation_score", 0.0)),
        "edge_balance_boost": float(weights.get("edge_balance_score", 0.0)),
        "person_boost": float((learned_profile or {}).get("themes", {}).get("person", 0.0)),
        "landscape_boost": float((learned_profile or {}).get("themes", {}).get("landscape", 0.0)),
        "food_boost": float((learned_profile or {}).get("themes", {}).get("food", 0.0)),
    }

    if feedback_profile:
        for key, value in feedback_profile.items():
            merged[key] = merged.get(key, 0.0) + value

    return merged


def _theme_boost(accepted_photos, rejected_photos, theme: str) -> float:
    def score(items):
        values = [_photo_theme_score(photo, theme) for photo in items]
        return sum(values) / len(values) if values else 0.0

    return max(0.0, score(accepted_photos) - score(rejected_photos))


def _photo_theme_score(photo, theme: str) -> float:
    face = photo.face_hint_score or 0.0
    composition = photo.composition_score or 0.0
    saturation = photo.saturation_score or 0.0
    width = float(photo.width or 0)
    height = float(photo.height or 0)
    aspect = width / height if width and height else 1.0

    if theme == "person":
        return min(1.0, face * 1.2)
    if theme == "landscape":
        return max(0.0, 1.0 - face) * (1.0 if aspect >= 1.1 else 0.6) * (0.5 + composition * 0.5)
    if theme == "food":
        return max(0.0, 1.0 - face) * (0.5 + saturation * 0.5) * (0.9 if 0.8 <= aspect <= 1.35 else 0.6)
    return 0.0
