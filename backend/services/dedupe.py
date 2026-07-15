"""유사사진 묶기. (소유: 4번 사진 분석·선별)

거의 같은 장면의 연속 촬영을 한 그룹으로 묶어, 그룹당 1장만 대표로 남깁니다.

완료 기준: 각 Photo 에 group_id 를 부여하여 반환.
"""
from __future__ import annotations

from pathlib import Path

from ..models import Photo


def group(photos: list[Photo], paths: dict[str, Path]) -> list[Photo]:
    """유사한 사진에 같은 group_id 를 부여.

    TODO(4번):
      - ImageHash(perceptual hash) 로 해시 계산
      - 해밍 거리 임계값 이하를 같은 그룹으로 묶기
      - 촬영시간 근접도 함께 고려
    현재는 사진마다 고유 그룹(=중복 없음)으로 둡니다.
    """
    for i, p in enumerate(photos):
        p.group_id = f"g{i}"
    return photos
