"""사진 그룹핑. (소유: 4번 사진 분석·선별)

같은 "장소(스팟)"의 사진을 한 그룹으로 묶습니다.
- GPS 가 있으면: 첫 사진 기준 100m 안이고 촬영 간격이 2분 이내면 같은 피드.
- GPS 가 없으면: 유사사진 해시(연속 촬영)로 묶음.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Optional

from PIL import Image

from ..models import Photo

_HASH_SIZE = 8
_MAX_HAMMING = 10
_SPOT_RADIUS_M = 100.0
_MAX_GROUP_GAP_SEC = 2 * 60


def group(photos: list[Photo], paths: dict[str, Path]) -> list[Photo]:
    """같은 장소(또는 유사 연속샷) 사진에 같은 group_id 를 부여."""
    location_anchors: list[dict] = []
    hash_reps: list[dict] = []
    next_group = 0

    for p in sorted(photos, key=_sort_key):
        # 1) 위치가 있으면 첫 사진 위치와 촬영 간격 기준으로 합류, 없으면 새 스팟
        if p.lat is not None and p.lng is not None:
            matched: dict | None = None
            for anchor in location_anchors:
                if _can_join_location_group(p, anchor):
                    matched = anchor
                    break
            if matched is None:
                gid = f"s{next_group}"
                next_group += 1
                location_anchors.append({
                    "gid": gid,
                    "lat": p.lat,
                    "lng": p.lng,
                    "last_time": p.taken_at,
                })
                p.group_id = gid
            else:
                p.group_id = matched["gid"]
                if p.taken_at:
                    matched["last_time"] = p.taken_at
            continue

        # 2) 위치가 없으면 유사사진 해시로 묶음
        h = _average_hash(paths.get(p.photo_id))
        if h is None:
            p.group_id = f"g{next_group}"
            next_group += 1
            continue
        matched: dict | None = None
        for rep in hash_reps:
            if _hamming(h, rep["hash"]) <= _MAX_HAMMING and _within_gap(rep["last_time"], p.taken_at):
                matched = rep
                break
        if matched is None:
            gid = f"g{next_group}"
            next_group += 1
            hash_reps.append({"gid": gid, "hash": h, "last_time": p.taken_at})
            p.group_id = gid
        else:
            p.group_id = matched["gid"]
            if p.taken_at:
                matched["last_time"] = p.taken_at

    return photos


def _sort_key(photo: Photo) -> float:
    if photo.taken_at:
        return photo.taken_at.timestamp()
    return float("inf")


def _can_join_location_group(photo: Photo, anchor: dict) -> bool:
    if not _within_gap(anchor.get("last_time"), photo.taken_at):
        return False
    return _haversine_m(photo.lat, photo.lng, anchor["lat"], anchor["lng"]) <= _SPOT_RADIUS_M


def _within_gap(left, right) -> bool:
    if left is None or right is None:
        return True
    return abs((right - left).total_seconds()) <= _MAX_GROUP_GAP_SEC


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


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
