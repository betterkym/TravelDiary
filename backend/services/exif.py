"""EXIF 촬영시간·GPS 추출. (소유: 4번 사진 분석·선별)

파이프라인 첫 단계: 원본 파일에서 메타데이터를 뽑아 Photo 를 채웁니다.
파일이 이미지가 아니거나 EXIF 가 없어도 예외 없이 통과합니다.
개인정보: GPS 원문과 EXIF 전체를 로그에 남기지 않습니다.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image
from PIL.ExifTags import IFD

from ..models import Photo

_EXIF_DATETIME_ORIGINAL = 0x9003   # DateTimeOriginal
_EXIF_DATETIME = 0x0132            # DateTime (fallback)


def extract(path: Path) -> Photo:
    """사진 파일 1장 -> Photo(메타데이터)."""
    photo = Photo(photo_id=uuid.uuid4().hex, filename=path.name)

    try:
        with Image.open(path) as img:
            photo.width, photo.height = img.size
            exif = img.getexif()
            photo.taken_at = _read_taken_at(exif)
            photo.lat, photo.lng = _read_gps(exif)
    except Exception:
        # 이미지가 아니거나 손상된 파일 → 파일명만 가진 채로 통과
        pass

    return photo


def _read_taken_at(exif) -> Optional[datetime]:
    try:
        ifd = exif.get_ifd(IFD.Exif)
        raw = ifd.get(_EXIF_DATETIME_ORIGINAL) or exif.get(_EXIF_DATETIME)
        if raw:
            # EXIF 형식: "YYYY:MM:DD HH:MM:SS"
            return datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def _read_gps(exif) -> tuple[Optional[float], Optional[float]]:
    try:
        gps = exif.get_ifd(IFD.GPSInfo)
        if not gps:
            return None, None
        lat = _to_decimal(gps.get(2), gps.get(1))   # GPSLatitude, GPSLatitudeRef
        lng = _to_decimal(gps.get(4), gps.get(3))   # GPSLongitude, GPSLongitudeRef
        return lat, lng
    except Exception:
        return None, None


def _to_decimal(dms, ref) -> Optional[float]:
    """(도, 분, 초) + 방향(N/S/E/W) -> 십진수 좌표."""
    if not dms or ref is None:
        return None
    try:
        deg, minutes, sec = (float(x) for x in dms)
        value = deg + minutes / 60 + sec / 3600
        if str(ref).upper() in ("S", "W"):
            value = -value
        return value
    except Exception:
        return None
