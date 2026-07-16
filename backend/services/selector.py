"""대표사진 선별. (소유: 4번 사진 분석·선별)

품질점수와 유사그룹을 바탕으로 장소별 대표사진을 최대 3장 고릅니다.
사진 파이프라인의 마지막 단계입니다: exif -> quality -> dedupe -> selector.
"""
from __future__ import annotations

import re
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

from .. import config
from ..models import Photo, SelectedPhoto

_REPRESENTATIVE_PER_GROUP = 3
_SIMILAR_TIME_GAP_SEC = 15
_SIMILAR_DISTANCE_M = 8.0


def select(
    photos: list[Photo],
    max_count: int = config.MAX_SELECTED_PHOTOS,
    preference_profile: dict[str, float] | None = None,
) -> list[SelectedPhoto]:
    """그룹별 대표사진 최대 3장 -> 품질순 상위 max_count 장 (선택 이유 포함)."""
    if not photos:
        return []

    # 1) 그룹별로 나눔 (group_id 없으면 각자 고유 그룹)
    groups: dict[str, list[Photo]] = {}
    for i, p in enumerate(photos):
        key = p.group_id or f"__solo_{i}"
        groups.setdefault(key, []).append(p)

    # 2) 그룹마다 품질 높은 컷을 최대 3장까지 대표 후보로
    #    - 흔들림/노출 등으로 rejected 된 사진은 제외.
    #    - 단, 그룹 전체가 rejected 면 그중 최고라도 남긴다(빈 자리 방지).
    candidates: list[tuple[Photo, int]] = []  # (사진, 그룹 크기)
    for members in groups.values():
        usable = [m for m in members if not getattr(m, "rejected", False)]
        pool = usable or members
        ranked = sorted(
            pool,
            key=lambda p: _rank_photo(p, preference_profile),
            reverse=True,
        )
        picked: list[Photo] = []
        for photo in ranked:
            if any(_too_similar(photo, selected) for selected in picked):
                continue
            picked.append(photo)
            if len(picked) >= _REPRESENTATIVE_PER_GROUP:
                break

        candidates.extend((photo, len(members)) for photo in picked)

    # 3) 품질순 정렬 후 상위 max_count 장
    candidates.sort(
        key=lambda c: _rank_photo(c[0], preference_profile),
        reverse=True,
    )

    selected: list[SelectedPhoto] = []
    for photo, group_size in candidates[:max_count]:
        selected.append(SelectedPhoto(
            photo_id=photo.photo_id,
            photo_url=f"/uploads/{photo.filename}",
            reason=_reason(photo, group_size),
        ))
    return selected


def _reason(photo: Photo, group_size: int) -> str:
    q = photo.quality_score
    quality_txt = f"품질 {q:.2f}" if q is not None else "품질 미측정"
    extra_bits = []
    if photo.face_hint_score is not None and photo.face_hint_score >= 0.7:
        extra_bits.append("중앙 피사체")
    if photo.composition_score is not None and photo.composition_score >= 0.7:
        extra_bits.append("구도 양호")
    if photo.exposure_score is not None and photo.exposure_score >= 0.7:
        extra_bits.append("노출 안정")
    extra = f" / {', '.join(extra_bits)}" if extra_bits else ""
    if group_size > 1:
        return f"유사 {group_size}장 중 대표 ({quality_txt}{extra})"
    return f"단독 사진 ({quality_txt}{extra})"


def _rank_photo(photo: Photo, preference_profile: dict[str, float] | None) -> tuple[float, float, float, float]:
    quality = photo.quality_score or 0.0
    composition = photo.composition_score or 0.0
    face_hint = photo.face_hint_score or 0.0
    resolution = photo.resolution_score or 0.0

    if preference_profile:
        quality += preference_profile.get("quality_boost", 0.0) * quality
        composition += preference_profile.get("composition_boost", 0.0) * composition
        face_hint += preference_profile.get("face_boost", 0.0) * face_hint
        resolution += preference_profile.get("resolution_boost", 0.0) * resolution

    return (quality, composition, face_hint, resolution)


def _too_similar(left: Photo, right: Photo) -> bool:
    if _same_duplicate_filename(left.filename, right.filename):
        return True

    if left.taken_at and right.taken_at:
        gap = abs((left.taken_at - right.taken_at).total_seconds())
        if gap > _SIMILAR_TIME_GAP_SEC:
            return False
    else:
        return False

    if left.lat is None or left.lng is None or right.lat is None or right.lng is None:
        return True

    return _haversine_m(left.lat, left.lng, right.lat, right.lng) <= _SIMILAR_DISTANCE_M


def _same_duplicate_filename(left: str, right: str) -> bool:
    left_original, left_normalized = _normalize_duplicate_filename(left)
    right_original, right_normalized = _normalize_duplicate_filename(right)
    if not left_normalized or not right_normalized:
        return False
    if left_normalized != right_normalized:
        return False
    return left_original != left_normalized or right_original != right_normalized or left_original == right_original


def _normalize_duplicate_filename(filename: str) -> tuple[str, str]:
    original = Path(filename or "").name.strip().lower()
    if not original:
        return "", ""
    normalized = re.sub(r"\s+\d+(?=\.[^.]+$)", "", original)
    normalized = re.sub(r"\s*\(\d+\)(?=\.[^.]+$)", "", normalized)
    normalized = re.sub(r"\s+copy(?=\.[^.]+$)", "", normalized)
    return original, normalized


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))
