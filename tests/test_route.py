from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.models import LocationPoint, Photo
from backend.services.route import build_route, build_route_from_photos


def _pt(lat: float, lng: float, hour: int) -> LocationPoint:
    return LocationPoint(lat=lat, lng=lng, time=datetime(2026, 7, 15, hour, tzinfo=timezone.utc))


def test_build_route_empty():
    route = build_route([])
    assert route.distance_m == 0
    assert route.duration_sec == 0


def test_build_route_distance_duration_and_stop_threshold():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    points = [
        LocationPoint(lat=37.0, lng=127.0, time=start),
        LocationPoint(lat=37.001, lng=127.001, time=start + timedelta(minutes=2)),
        LocationPoint(lat=37.001, lng=127.001, time=start + timedelta(minutes=6)),
    ]

    route = build_route(points)

    assert route.distance_m > 0
    assert route.duration_sec == 360
    assert len(route.stops) == 1
    assert route.stops[0].arrived_at == start + timedelta(minutes=2)
    assert route.stops[0].left_at == start + timedelta(minutes=6)


def test_build_route_from_photos_uses_exif_gps_and_time():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="1.jpg", taken_at=start, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="2.jpg", taken_at=start + timedelta(minutes=2), lat=37.001, lng=127.001),
        Photo(photo_id="3", filename="3.jpg", taken_at=start + timedelta(minutes=6), lat=37.001, lng=127.001),
    ]

    route = build_route_from_photos(photos)

    assert route is not None
    assert route.distance_m > 0
    assert route.duration_sec == 360
    assert len(route.stops) == 1
    assert route.stops[0].arrived_at == start + timedelta(minutes=2)
    assert route.stops[0].left_at == start + timedelta(minutes=6)
