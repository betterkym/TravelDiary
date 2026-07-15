"""3번 GPS·경로 - route.build_route 테스트. (소유: 정가희 @jghkor-ctrl)"""
from datetime import datetime, timezone

from backend.models import LocationPoint
from backend.services import route


def _pt(lat, lng, hour):
    return LocationPoint(lat=lat, lng=lng, time=datetime(2026, 7, 15, hour, tzinfo=timezone.utc))


def test_build_route_empty():
    r = route.build_route([])
    assert r.distance_m == 0 and r.duration_sec == 0


def test_build_route_distance_and_duration():
    r = route.build_route([_pt(37.0, 127.0, 10), _pt(37.01, 127.01, 11)])
    assert r.distance_m > 0
    assert r.duration_sec == 3600


# TODO(3번): 정차 지점(stops) 검출 후 3~5개 반환 테스트 추가
