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
    preference_profile = _build_preference_profile(photos, feedback)
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
    }
