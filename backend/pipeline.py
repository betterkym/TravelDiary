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
    selected = selector.select(photos)

    entries = timeline.build(trip_route, selected, photos)
    entries = diary.annotate(entries)

    result = Diary(
        trip_id=trip_id,
        route=trip_route,
        selected_photos=selected,
        timeline=entries,
    )
    storage.save_diary(trip_id, result)
    return result
