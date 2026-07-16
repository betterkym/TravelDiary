"""5번 다이어리 - timeline.build 테스트. (소유: 최고은 @cge030809)"""
from datetime import datetime, timedelta, timezone

from backend.models import Photo, Route, SelectedPhoto
from backend.services import timeline


def test_build_makes_entry_for_selected_photo():
    photos = [Photo(photo_id="1", filename="a.jpg")]
    selected = [SelectedPhoto(photo_id="1", photo_url="/outputs/a.jpg")]
    entries = timeline.build(Route(), selected, photos)
    assert len(entries) == 1
    assert entries[0].photo_url == "/outputs/a.jpg"


def test_build_merges_same_place_selected_photos_into_one_feed():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", taken_at=base + timedelta(seconds=90), lat=37.0002, lng=127.0002),
    ]
    selected = [
        SelectedPhoto(photo_id="1", photo_url="/uploads/a.jpg"),
        SelectedPhoto(photo_id="2", photo_url="/uploads/b.jpg"),
    ]

    entries = timeline.build(Route(), selected, photos)

    assert len(entries) == 1
    assert entries[0].photo_count == 2
    assert entries[0].photo_urls == ["/uploads/a.jpg", "/uploads/b.jpg"]
    assert entries[0].photo_ids == ["1", "2"]


def test_build_splits_same_place_when_time_gap_exceeds_two_minutes():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", taken_at=base + timedelta(minutes=3), lat=37.0002, lng=127.0002),
    ]
    selected = [
        SelectedPhoto(photo_id="1", photo_url="/uploads/a.jpg"),
        SelectedPhoto(photo_id="2", photo_url="/uploads/b.jpg"),
    ]

    entries = timeline.build(Route(), selected, photos)

    assert len(entries) == 2


def test_build_keeps_far_places_as_separate_feeds():
    base = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    photos = [
        Photo(photo_id="1", filename="a.jpg", taken_at=base, lat=37.0, lng=127.0),
        Photo(photo_id="2", filename="b.jpg", taken_at=base + timedelta(seconds=90), lat=37.01, lng=127.01),
    ]
    selected = [
        SelectedPhoto(photo_id="1", photo_url="/uploads/a.jpg"),
        SelectedPhoto(photo_id="2", photo_url="/uploads/b.jpg"),
    ]

    entries = timeline.build(Route(), selected, photos)

    assert len(entries) == 2


def test_build_handles_no_photos():
    assert timeline.build(Route(), [], []) == []


# TODO(5번): 촬영시간순 정렬 / 정차 지점(place) 매칭 / 시간·GPS 누락 처리 테스트 추가
