"""EXIF 촬영시간·GPS 추출. (소유: 4번 사진 분석·선별)

파이프라인 첫 단계: 원본 파일에서 메타데이터를 뽑아 Photo 를 채웁니다.

완료 기준: 실제 사진에서 촬영시간/GPS/크기를 읽어 Photo 로 반환.
개인정보: GPS 원문과 EXIF 전체를 로그에 남기지 않습니다.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from ..models import Photo


def extract(path: Path) -> Photo:
    """사진 파일 1장 -> Photo(메타데이터).

    TODO(4번):
      - Pillow 로 EXIF 파싱 (DateTimeOriginal, GPSInfo)
      - 방향(Orientation) 보정 고려
      - width/height 채우기
    현재는 파일명만 채운 골격을 반환합니다.
    """
    return Photo(
        photo_id=uuid.uuid4().hex,
        filename=path.name,
        # taken_at / lat / lng / width / height 는 4번이 채웁니다.
    )
