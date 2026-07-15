"""대표사진 선별. (소유: 4번 사진 분석·선별)

품질점수와 유사그룹을 바탕으로 대표사진을 최대 8장 고릅니다.
사진 파이프라인의 마지막 단계입니다: exif -> quality -> dedupe -> selector.
"""
from __future__ import annotations

from .. import config
from ..models import Photo, SelectedPhoto


def select(photos: list[Photo], max_count: int = config.MAX_SELECTED_PHOTOS) -> list[SelectedPhoto]:
    """그룹별 최고 품질 1장 -> 품질순 상위 max_count 장 (선택 이유 포함)."""
    if not photos:
        return []

    # 1) 그룹별로 나눔 (group_id 없으면 각자 고유 그룹)
    groups: dict[str, list[Photo]] = {}
    for i, p in enumerate(photos):
        key = p.group_id or f"__solo_{i}"
        groups.setdefault(key, []).append(p)

    # 2) 그룹마다 품질 최고 1장을 대표 후보로
    candidates: list[tuple[Photo, int]] = []  # (사진, 그룹 크기)
    for members in groups.values():
        best = max(members, key=lambda p: p.quality_score or 0.0)
        candidates.append((best, len(members)))

    # 3) 품질순 정렬 후 상위 max_count 장
    candidates.sort(key=lambda c: c[0].quality_score or 0.0, reverse=True)

    selected: list[SelectedPhoto] = []
    for photo, group_size in candidates[:max_count]:
        selected.append(SelectedPhoto(
            photo_id=photo.photo_id,
            photo_url=f"/outputs/{photo.filename}",
            reason=_reason(photo, group_size),
        ))
    return selected


def _reason(photo: Photo, group_size: int) -> str:
    q = photo.quality_score
    quality_txt = f"품질 {q:.2f}" if q is not None else "품질 미측정"
    if group_size > 1:
        return f"유사 {group_size}장 중 대표 ({quality_txt})"
    return f"단독 사진 ({quality_txt})"
