from __future__ import annotations

from datetime import datetime, timezone
from math import atan2, cos, radians, sin, sqrt
from typing import Protocol, Sequence

from ..models import LocationPoint, Photo, Route, Stop

STOP_GAP_SEC = 180
SAME_PLACE_RADIUS_M = 30.0


class _RoutePoint(Protocol):
    lat: float
    lng: float
    time: datetime


def _haversine_m(a: _RoutePoint, b: _RoutePoint) -> float:
    """Return distance in meters between two GPS points."""
    r = 6_371_000
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


def build_route(points: Sequence[_RoutePoint]) -> Route:
    """Build a GPS-based route summary from time-ordered points.

    The route follows the photo trail itself:
    - points are sorted by capture time
    - total distance is accumulated from consecutive GPS points
    - stops are recorded when points stay within the same place radius for at
      least 3 minutes
    """
    ordered = [p for p in sorted(points, key=_sort_key)]
    if len(ordered) < 2:
        return Route()

    distance = 0.0
    stops: list[Stop] = []
    cluster_start = ordered[0]
    cluster_end = ordered[0]

    for prev, curr in zip(ordered, ordered[1:]):
        segment_distance = _haversine_m(prev, curr)
        distance += segment_distance

        if segment_distance <= SAME_PLACE_RADIUS_M:
            cluster_end = curr
        else:
            _append_stop_if_needed(stops, cluster_start, cluster_end)
            cluster_start = curr
            cluster_end = curr

    _append_stop_if_needed(stops, cluster_start, cluster_end)

    duration = (ordered[-1].time - ordered[0].time).total_seconds()
    return Route(distance_m=int(distance), duration_sec=int(duration), stops=stops)


def build_route_from_photos(photos: Sequence[Photo]) -> Route | None:
    """Build a route from photo EXIF GPS/time metadata.

    Returns ``None`` when there are not enough usable photo points yet.
    """
    points = [
        LocationPoint(lat=float(photo.lat), lng=float(photo.lng), time=photo.taken_at)
        for photo in photos
        if photo.taken_at is not None and photo.lat is not None and photo.lng is not None
    ]
    if len(points) < 2:
        return None
    return build_route(points)


def _append_stop_if_needed(stops: list[Stop], start: _RoutePoint, end: _RoutePoint) -> None:
    """Store a stop only when the same-place cluster lasted 3 minutes or more."""
    if (end.time - start.time).total_seconds() < STOP_GAP_SEC:
        return

    stops.append(
        Stop(
            lat=float(start.lat),
            lng=float(start.lng),
            arrived_at=start.time,
            left_at=end.time,
        )
    )


def _sort_key(point: _RoutePoint) -> datetime:
    """Fallback sort key for malformed points."""
    return point.time or datetime.max.replace(tzinfo=timezone.utc)
