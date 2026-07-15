"""4번 사진 - dedupe.group 테스트. (소유: 이주현 @jhlee0219)"""
from backend.models import Photo
from backend.services import dedupe


def test_group_assigns_group_ids():
    photos = [Photo(photo_id=str(i), filename=f"{i}.jpg") for i in range(3)]
    out = dedupe.group(photos, {})
    assert all(p.group_id for p in out)


# TODO(4번): 유사한 사진이 같은 group_id 로 묶이는지 테스트 추가
