"""4번 사진 - dedupe.group 테스트. (소유: 이주현 @jhlee0219)"""
from datetime import datetime, timedelta, timezone

from backend.models import Photo
from backend.services import dedupe


def test_group_assigns_group_ids():
    photos = [Photo(photo_id=str(i), filename=f"{i}.jpg") for i in range(3)]
    out = dedupe.group(photos, {})
    assert all(p.group_id for p in out)


def test_group_merges_photos_within_100m_and_two_minutes():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", taken_at=base + timedelta(seconds=90), lat=37.0005, lng=127.0005),
    ]

    out = dedupe.group(photos, {})

    assert out[0].group_id == out[1].group_id


def test_group_splits_same_place_after_two_minutes():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", taken_at=base + timedelta(minutes=3), lat=37.0005, lng=127.0005),
    ]

    out = dedupe.group(photos, {})

    assert out[0].group_id != out[1].group_id
