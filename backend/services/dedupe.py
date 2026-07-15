"""유사사진 묶기. (소유: 4번 사진 분석·선별)

거의 같은 장면의 연속 촬영을 한 그룹으로 묶어, 그룹당 1장만 대표로 남깁니다.
perceptual hash(average hash)를 Pillow 만으로 계산하고, 해밍 거리로 묶습니다.
파일을 못 열면 그 사진은 고유 그룹으로 둡니다(안전).
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from PIL import Image

from ..models import Photo

_HASH_SIZE = 8              # 8x8. RGB 3채널 → 192비트 해시
_MAX_HAMMING = 12          # 이 거리 이하면 같은 그룹(비슷한 사진)


def group(photos: list[Photo], paths: dict[str, Path]) -> list[Photo]:
    """유사한 사진에 같은 group_id 를 부여."""
    hashes: dict[str, Optional[int]] = {
        p.photo_id: _average_hash(paths.get(p.photo_id)) for p in photos
    }

    reps: list[tuple[str, int]] = []  # (group_id, 대표 해시)
    next_group = 0

    for p in photos:
        h = hashes[p.photo_id]
        if h is None:
            # 해시 실패 → 항상 새 고유 그룹
            p.group_id = f"g{next_group}"
            next_group += 1
            continue

        matched = None
        for gid, rep_hash in reps:
            if _hamming(h, rep_hash) <= _MAX_HAMMING:
                matched = gid
                break

        if matched is None:
            gid = f"g{next_group}"
            next_group += 1
            reps.append((gid, h))
            p.group_id = gid
        else:
            p.group_id = matched

    return photos


def _average_hash(path: Optional[Path]) -> Optional[int]:
    """8x8 RGB 평균 해시 → 192비트 정수 (색까지 반영해 다른 장면을 구분)."""
    if path is None:
        return None
    try:
        with Image.open(path) as img:
            small = img.convert("RGB").resize((_HASH_SIZE, _HASH_SIZE))
        bits = 0
        # R, G, B 채널마다 평균 대비 밝기 비트를 이어붙임
        for channel in small.split():
            pixels = list(channel.getdata())
            avg = sum(pixels) / len(pixels)
            for px in pixels:
                bits = (bits << 1) | (1 if px >= avg else 0)
        return bits
    except Exception:
        return None


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")
