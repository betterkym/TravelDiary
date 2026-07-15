"""3번 GPS·경로 - location.clean 테스트. (소유: 정가희 @jghkor-ctrl)"""
from datetime import datetime, timezone

from backend.models import LocationPoint
from backend.services import location


def test_clean_survives_empty():
    assert location.clean([]) == []


def test_clean_sorts_by_time():
    early = datetime(2026, 7, 15, 10, tzinfo=timezone.utc)
    late = datetime(2026, 7, 15, 11, tzinfo=timezone.utc)
    pts = [
        LocationPoint(lat=1, lng=1, time=late),
        LocationPoint(lat=0, lng=0, time=early),
    ]
    assert [p.time for p in location.clean(pts)] == [early, late]


# TODO(3번): accuracy 큰 지점 제외 / 순간이동 제외 / 중복 제거 테스트 추가
