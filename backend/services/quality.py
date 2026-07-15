"""흐림·노출·해상도 품질 평가. (소유: 4번 사진 분석·선별)

각 사진에 0~1 품질점수를 매겨 대표사진 선별의 근거로 씁니다.

완료 기준: 사진마다 quality_score 를 채워 반환.
"""
from __future__ import annotations

from pathlib import Path

from ..models import Photo


def score(photo: Photo, path: Path) -> Photo:
    """Photo 에 quality_score(0~1) 를 채워 반환.

    TODO(4번):
      - 흐림: 라플라시안 분산 등으로 선명도 측정
      - 노출: 히스토그램으로 과다/과소 노출 감지
      - 해상도: 너무 작은 이미지 감점
    현재는 중립값 0.5 를 부여합니다.
    """
    photo.quality_score = 0.5
    return photo
