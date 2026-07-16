"""유사사진 묶기. (소유: 4번 사진 분석·선별)

거의 같은 장면의 연속 촬영을 한 그룹으로 묶어, 그룹당 1장만 대표로 남깁니다.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from PIL import Image

from ..models import Photo

_HASH_SIZE = 8
_MAX_HAMMING = 6
_MAX_TIME_GAP_SEC = 2 * 60


def group(photos: list[Photo], paths: dict[str, Path]) -> list[Photo]:
    """유사한 사진에 같은 group_id 를 부여."""
    hashes: dict[str, int | None] = {p.photo_id: _average_hash(paths.get(p.photo_id)) for p in photos}
    reps: list[tuple[str, int]] = []
    next_group = 0
    last_photo_by_group: dict[str, Photo] = {}

    for p in photos:
        h = hashes[p.photo_id]
        if h is None:
            p.group_id = f"g{next_group}"
            next_group += 1
            last_photo_by_group[p.group_id] = p
            continue

        matched = None
        for gid, rep_hash in reps:
            prev = last_photo_by_group.get(gid)
            if prev and _same_place(prev, p) and _is_time_close(prev, p):
                matched = gid
                break
            if _hamming(h, rep_hash) <= _MAX_HAMMING:
                matched = gid
                break

        if matched is None:
            gid = f"g{next_group}"
            next_group += 1
            reps.append((gid, h))
            p.group_id = gid
            last_photo_by_group[gid] = p
        else:
            p.group_id = matched
            last_photo_by_group[matched] = p

    return photos


def _average_hash(path: Optional[Path]) -> Optional[int]:
    if path is None:
        return None
    try:
        with Image.open(path) as img:
            small = img.convert("L").resize((_HASH_SIZE, _HASH_SIZE), Image.Resampling.LANCZOS)
        bits = 0
        pixels = list(small.getdata())
        avg = sum(pixels) / len(pixels)
        for px in pixels:
            bits = (bits << 1) | (1 if px >= avg else 0)
        return bits
    except Exception:
        return None


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _is_time_close(left: Photo, right: Photo) -> bool:
    if left.taken_at is None or right.taken_at is None:
        return False
    return abs((right.taken_at - left.taken_at).total_seconds()) <= _MAX_TIME_GAP_SEC


def _same_place(left: Photo, right: Photo) -> bool:
    if left.lat is None or left.lng is None or right.lat is None or right.lng is None:
        return False
    # 대략 100m 안이면 같은 장소로 본다.
    return _haversine_m(left.lat, left.lng, right.lat, right.lng) <= 100


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    r = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(min(1, sqrt(h)))
