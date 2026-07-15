"""4번 사진 - exif.extract 테스트. (소유: 이주현 @jhlee0219)"""
from backend.services import exif


def test_extract_returns_photo_with_filename(tmp_path):
    f = tmp_path / "sample.jpg"
    f.write_bytes(b"\xff\xd8\xff")  # JPEG 헤더 흉내
    photo = exif.extract(f)
    assert photo.filename == "sample.jpg"
    assert photo.photo_id  # 고유 id 부여됨


# TODO(4번): 실제 EXIF 에서 taken_at / lat / lng / width / height 추출 테스트 추가
