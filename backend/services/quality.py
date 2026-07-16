"""흐림·노출·해상도 품질 평가. (소유: 4번 사진 분석·선별)

각 사진에 0~1 품질점수를 매겨 대표사진 선별의 근거로 씁니다.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from ..models import Photo

_BLUR_THRESHOLD = 35.0
_MIN_MEGAPIXELS = 0.75
_PREFERRED_MEGAPIXELS = 4.0
_MIN_SHORT_EDGE = 720
_PREFERRED_SHORT_EDGE = 1600
_CENTER_WEIGHT = 0.55
_EDGE_WEIGHT = 0.45

# --- 하드 컷(삭제) 임계값: 명백히 못 쓰는 사진만 걸러낸다(보수적) ---
_HARD_BLUR_MIN = 8.0       # Laplacian variance 이 값 미만 = 심한 흔들림/초점 실패
_HARD_DARK_RATIO = 0.45    # 완전 암부 픽셀 비율이 이보다 크면 너무 어두움
_HARD_HIGHLIGHT_RATIO = 0.45  # 완전 백부 픽셀 비율이 이보다 크면 노출 과다
_HARD_MIN_SHORT_EDGE = 480    # 짧은 변이 이보다 작으면 해상도 부족
_HARD_BACKLIGHT = 0.32     # 배경 대비 중앙(피사체)이 이만큼 어두우면 역광


def _scale(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def _laplacian_variance(gray: np.ndarray) -> float:
    if gray.ndim != 2 or gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    center = gray[1:-1, 1:-1]
    laplacian = (
        gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
        - (4 * center)
    )
    return float(np.var(laplacian))


def _center_weight_score(gray: np.ndarray) -> float:
    if gray.ndim != 2:
        return 0.0
    h, w = gray.shape
    if h < 6 or w < 6:
        return 0.0

    y0, y1 = int(h * 0.2), int(h * 0.8)
    x0, x1 = int(w * 0.2), int(w * 0.8)
    center = gray[y0:y1, x0:x1]
    if center.size == 0:
        return 0.0

    full_mean = float(np.mean(gray))
    center_mean = float(np.mean(center))
    contrast = abs(center_mean - full_mean) / 255.0
    return max(0.0, min(1.0, 1.0 - contrast * 2.0))


def _edge_balance_score(gray: np.ndarray) -> float:
    if gray.ndim != 2:
        return 0.0
    h, w = gray.shape
    if h < 8 or w < 8:
        return 0.0

    left = float(np.mean(gray[:, : w // 2]))
    right = float(np.mean(gray[:, w // 2 :]))
    top = float(np.mean(gray[: h // 2, :]))
    bottom = float(np.mean(gray[h // 2 :, :]))
    lr = abs(left - right) / 255.0
    tb = abs(top - bottom) / 255.0
    return max(0.0, min(1.0, 1.0 - ((lr + tb) / 2.0)))


def _saturation_score(path: Path) -> float:
    try:
        with Image.open(path) as img:
            rgb = ImageOps.exif_transpose(img).convert("RGB")
            arr = np.asarray(rgb, dtype=np.float32) / 255.0
            maxc = arr.max(axis=2)
            minc = arr.min(axis=2)
            sat = np.where(maxc == 0, 0.0, (maxc - minc) / np.maximum(maxc, 1e-6))
            mean_sat = float(np.mean(sat))
            # 너무 낮거나 너무 높은 채도 모두 감점
            return max(0.0, min(1.0, 1.0 - abs(mean_sat - 0.42) / 0.42))
    except Exception:
        return 0.5


def _backlight_score(gray: np.ndarray) -> float:
    # 역광 추정: 배경(테두리)이 밝고 중앙(피사체)이 어두울수록 값이 커짐(0~1).
    if gray.ndim != 2:
        return 0.0
    h, w = gray.shape
    if h < 8 or w < 8:
        return 0.0
    center = gray[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)]
    border = np.concatenate([
        gray[: max(1, int(h * 0.15)), :].ravel(),
        gray[max(0, int(h * 0.85)) :, :].ravel(),
        gray[:, : max(1, int(w * 0.15))].ravel(),
        gray[:, max(0, int(w * 0.85)) :].ravel(),
    ])
    if center.size == 0 or border.size == 0:
        return 0.0
    center_mean = float(np.mean(center)) / 255.0
    border_mean = float(np.mean(border)) / 255.0
    return max(0.0, border_mean - center_mean)


def _face_hint_score(gray: np.ndarray) -> float:
    # 얼굴 검출이 없는 환경에서, 인물 사진일 가능성을 간접적으로 추정.
    if gray.ndim != 2:
        return 0.0
    h, w = gray.shape
    if h < 8 or w < 8:
        return 0.0

    center = gray[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)]
    border = np.concatenate([
        gray[: max(1, int(h * 0.15)), :].ravel(),
        gray[max(0, int(h * 0.85)) :, :].ravel(),
        gray[:, : max(1, int(w * 0.15))].ravel(),
        gray[:, max(0, int(w * 0.85)) :].ravel(),
    ])
    if center.size == 0 or border.size == 0:
        return 0.0
    center_std = float(np.std(center))
    border_std = float(np.std(border))
    # 중앙 디테일이 배경보다 더 많은 경우 인물/주제 중앙 배치로 간주
    return max(0.0, min(1.0, (center_std - border_std + 15.0) / 30.0))


def score(photo: Photo, path: Path) -> Photo:
    """Photo 에 quality_score(0~1) 를 채워 반환."""
    try:
        with Image.open(path) as img:
            normalized = ImageOps.exif_transpose(img)
            width, height = normalized.size
            gray_img = normalized.convert("L")
            gray_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            gray = np.asarray(gray_img, dtype=np.float32)

            sharpness_raw = _laplacian_variance(gray)
            sharpness_score = _scale(math.log1p(sharpness_raw), math.log1p(20), math.log1p(350))

            megapixels = (width * height) / 1_000_000
            short_edge = min(width, height)
            megapixel_score = _scale(megapixels, _MIN_MEGAPIXELS, _PREFERRED_MEGAPIXELS)
            short_edge_score = _scale(short_edge, _MIN_SHORT_EDGE, _PREFERRED_SHORT_EDGE)
            resolution_score = (0.6 * megapixel_score) + (0.4 * short_edge_score)

            brightness = float(np.mean(gray)) / 255.0
            darkness_ratio = float(np.mean(gray <= 5))
            highlight_ratio = float(np.mean(gray >= 250))
            brightness_score = 1 - min(1.0, abs(brightness - 0.5) / 0.5)
            clipping_score = 1 - min(1.0, (darkness_ratio + highlight_ratio) / 0.35)
            exposure_score = (0.6 * brightness_score) + (0.4 * clipping_score)

            composition_score = _center_weight_score(gray)
            edge_balance = _edge_balance_score(gray)
            saturation = _saturation_score(path)
            face_hint = _face_hint_score(gray)
            backlight = _backlight_score(gray)

            # 사진 culling에 맞춰 "보기 좋은 컷"을 우선. 선명도/구도/노출을 중심으로 구성.
            total_score = (
                (0.40 * sharpness_score)
                + (0.20 * resolution_score)
                + (0.15 * exposure_score)
                + (0.15 * composition_score)
                + (0.05 * edge_balance)
                + (0.03 * saturation)
                + (0.02 * face_hint)
            )
            # 역광은 감점(피사체가 어두워 보임)
            total_score = max(0.0, total_score - 0.5 * backlight)

            # --- 하드 컷: 명백히 못 쓰는 사진은 rejected 처리 ---
            reject_reason = ""
            if sharpness_raw < _HARD_BLUR_MIN:
                reject_reason = "흔들림/초점 실패"
            elif darkness_ratio > _HARD_DARK_RATIO:
                reject_reason = "너무 어두움"
            elif highlight_ratio > _HARD_HIGHLIGHT_RATIO:
                reject_reason = "노출 과다(너무 밝음)"
            elif short_edge < _HARD_MIN_SHORT_EDGE:
                reject_reason = "해상도 부족"
            elif backlight > _HARD_BACKLIGHT:
                reject_reason = "역광(피사체 어두움)"

            photo.quality_score = round(total_score, 3)
            photo.sharpness_raw = round(sharpness_raw, 3)
            photo.sharpness_score = round(sharpness_score, 3)
            photo.resolution_score = round(resolution_score, 3)
            photo.exposure_score = round(exposure_score, 3)
            photo.composition_score = round(composition_score, 3)
            photo.edge_balance_score = round(edge_balance, 3)
            photo.saturation_score = round(saturation, 3)
            photo.face_hint_score = round(face_hint, 3)
            photo.backlight_score = round(backlight, 3)
            photo.rejected = bool(reject_reason)
            photo.reject_reason = reject_reason
    except Exception:
        photo.quality_score = 0.5   # 판단 불가 → 중립
    return photo
