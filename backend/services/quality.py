"""흐림·노출·해상도 품질 평가. (소유: 4번 사진 분석·선별)

각 사진에 0~1 품질점수를 매겨 대표사진 선별의 근거로 씁니다.
numpy/OpenCV 없이 Pillow(ImageStat/ImageFilter)만으로 계산합니다.
파일이 없거나 손상돼도 중립값을 주고 통과합니다.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter, ImageStat

from ..models import Photo

# 정규화 기준
_SHARPNESS_FULL = 40.0     # 엣지 표준편차가 이 정도면 충분히 선명(1.0)
_GOOD_BRIGHT_LO = 40       # 적정 밝기 하한
_GOOD_BRIGHT_HI = 215      # 적정 밝기 상한
_MIN_PIXELS = 640 * 480    # 이보다 작으면 해상도 감점 시작


def score(photo: Photo, path: Path) -> Photo:
    """Photo 에 quality_score(0~1) 를 채워 반환."""
    try:
        with Image.open(path) as img:
            gray = img.convert("L")
            sharp = _sharpness(gray)
            expo = _exposure(gray)
            res = _resolution(img.size)
            # 흐림을 가장 크게, 노출·해상도를 보조로
            photo.quality_score = round(0.6 * sharp + 0.25 * expo + 0.15 * res, 3)
    except Exception:
        photo.quality_score = 0.5   # 판단 불가 → 중립
    return photo


def _sharpness(gray: Image.Image) -> float:
    """엣지 강도의 표준편차로 선명도 추정 (0~1)."""
    edges = gray.filter(ImageFilter.FIND_EDGES)
    stddev = ImageStat.Stat(edges).stddev[0]
    return min(stddev / _SHARPNESS_FULL, 1.0)


def _exposure(gray: Image.Image) -> float:
    """평균 밝기가 적정 구간이면 1, 너무 어둡거나 밝으면 감점 (0~1)."""
    mean = ImageStat.Stat(gray).mean[0]
    if _GOOD_BRIGHT_LO <= mean <= _GOOD_BRIGHT_HI:
        return 1.0
    if mean < _GOOD_BRIGHT_LO:
        return max(mean / _GOOD_BRIGHT_LO, 0.0)
    return max((255 - mean) / (255 - _GOOD_BRIGHT_HI), 0.0)


def _resolution(size: tuple[int, int]) -> float:
    """총 픽셀 수 기준 (0~1)."""
    pixels = size[0] * size[1]
    return min(pixels / _MIN_PIXELS, 1.0)
