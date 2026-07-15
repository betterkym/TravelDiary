"""4번 사진 - quality.score 테스트. (소유: 이주현 @jhlee0219)"""
from backend.models import Photo
from backend.services import quality


def test_score_sets_quality_in_range(tmp_path):
    photo = Photo(photo_id="1", filename="a.jpg")
    out = quality.score(photo, tmp_path / "a.jpg")
    assert out.quality_score is not None
    assert 0.0 <= out.quality_score <= 1.0


# TODO(4번): 흐림/노출/해상도별로 점수가 달라지는지 테스트 추가
