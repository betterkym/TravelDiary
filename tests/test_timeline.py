"""5번 다이어리 - timeline.build 테스트. (소유: 최고은 @cge030809)"""
from backend.models import Photo, Route, SelectedPhoto
from backend.services import timeline


def test_build_makes_entry_per_selected():
    photos = [Photo(photo_id="1", filename="a.jpg")]
    selected = [SelectedPhoto(photo_id="1", photo_url="/outputs/a.jpg")]
    entries = timeline.build(Route(), selected, photos)
    assert len(entries) == 1
    assert entries[0].photo_url == "/outputs/a.jpg"


def test_build_handles_no_photos():
    assert timeline.build(Route(), [], []) == []


# TODO(5번): 촬영시간순 정렬 / 정차 지점(place) 매칭 / 시간·GPS 누락 처리 테스트 추가
