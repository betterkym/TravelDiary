"""좌표 검증·정렬·이상치 제거. (소유: 3번 GPS·경로)

브라우저 Geolocation 은 튀는 좌표(정확도 낮음, 순간이동)를 포함하므로
경로 계산 전에 먼저 정리합니다. 좌표가 누락돼도 중단되지 않습니다.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

from ..models import LocationPoint

# 임계값
MAX_ACCURACY_M = 100.0    # 정확도(반경)가 이보다 크면 신뢰도 낮음 → 제외
MAX_SPEED_MPS = 83.0      # 약 300km/h. 이보다 빠르면 순간이동으로 간주 → 제외
MIN_MOVE_M = 2.0          # 직전과 이만큼도 안 움직였으면 중복으로 간주


def _haversine_m(a: LocationPoint, b: LocationPoint) -> float:
    r = 6_371_000
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


def clean(points: list[LocationPoint]) -> list[LocationPoint]:
    """시간순 정렬 + 이상치/중복 제거.

    - accuracy_m 가 너무 큰 지점 제외
    - 직전 지점 대비 속도가 비현실적(순간이동)이면 제외
    - 거의 안 움직인 연속 중복 제외
    """
    if not points:
        return []

    ordered = sorted(points, key=lambda p: p.time)

    cleaned: list[LocationPoint] = []
    for p in ordered:
        # 1) 정확도 필터
        if p.accuracy_m is not None and p.accuracy_m > MAX_ACCURACY_M:
            continue

        if cleaned:
            prev = cleaned[-1]
            dist = _haversine_m(prev, p)
            dt = (p.time - prev.time).total_seconds()

            # 2) 순간이동 필터 (시간차가 있을 때만 속도 계산)
            if dt > 0 and dist / dt > MAX_SPEED_MPS:
                continue
            # 3) 중복 필터
            if dist < MIN_MOVE_M:
                continue

        cleaned.append(p)

    return cleaned
