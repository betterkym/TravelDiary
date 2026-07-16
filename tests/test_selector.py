"""4번 사진 - selector.select 테스트. (소유: 이주현 @jhlee0219)"""
from datetime import datetime, timedelta, timezone

from backend.models import Photo
from backend.services import selector


def test_select_caps_at_max():
    photos = [Photo(photo_id=str(i), filename=f"{i}.jpg") for i in range(12)]
    out = selector.select(photos, max_count=8)
    assert len(out) == 8
    assert out[0].photo_url.startswith("/uploads/")


def test_select_fewer_than_max():
    photos = [Photo(photo_id="1", filename="a.jpg")]
    assert len(selector.select(photos, max_count=8)) == 1


def test_select_keeps_up_to_three_representatives_per_group():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", group_id="g1", quality_score=0.9, taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", group_id="g1", quality_score=0.8, taken_at=base + timedelta(seconds=30), lat=37.0003, lng=127.0003),
        Photo(photo_id="3", filename="c.jpg", group_id="g1", quality_score=0.7, taken_at=base + timedelta(seconds=60), lat=37.0006, lng=127.0006),
        Photo(photo_id="4", filename="d.jpg", group_id="g1", quality_score=0.6, taken_at=base + timedelta(seconds=90), lat=37.0009, lng=127.0009),
    ]

    out = selector.select(photos, max_count=8)

    assert len(out) == 3


def test_select_excludes_too_similar_representatives():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", group_id="g1", quality_score=0.9, taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", group_id="g1", quality_score=0.8, taken_at=base + timedelta(seconds=5), lat=37.0, lng=127.0),
        Photo(photo_id="3", filename="c.jpg", group_id="g1", quality_score=0.7, taken_at=base + timedelta(seconds=30), lat=37.0003, lng=127.0003),
    ]

    out = selector.select(photos, max_count=8)

    assert [item.photo_id for item in out] == ["1", "3"]


def test_select_excludes_copied_duplicate_filenames():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="IMG_0302.JPG", group_id="g1", quality_score=0.9, taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="IMG_0302 2.JPG", group_id="g1", quality_score=0.8, taken_at=base + timedelta(seconds=45), lat=37.00001, lng=127.00001),
        Photo(photo_id="3", filename="IMG_0303.JPG", group_id="g1", quality_score=0.7, taken_at=base + timedelta(seconds=90), lat=37.0004, lng=127.0004),
    ]

    out = selector.select(photos, max_count=8)

    assert [item.photo_id for item in out] == ["1", "3"]
