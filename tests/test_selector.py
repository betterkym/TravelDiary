"""4번 사진 - selector.select 테스트. (소유: 이주현 @jhlee0219)"""
from backend.models import Photo
from backend.services import selector


def test_select_caps_at_max():
    photos = [Photo(photo_id=str(i), filename=f"{i}.jpg") for i in range(12)]
    out = selector.select(photos, max_count=8)
    assert len(out) == 8
    assert out[0].photo_url.startswith("/outputs/")


def test_select_fewer_than_max():
    photos = [Photo(photo_id="1", filename="a.jpg")]
    assert len(selector.select(photos, max_count=8)) == 1


# TODO(4번): 그룹별 최고 품질 1장만 후보로 / reason 근거 채우기 테스트 추가
