"""거리·시간·정차 지점 계산. (소유: 3번 GPS·경로)

정리된 좌표열로부터 경로 요약(Route)을 만듭니다.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

from ..models import LocationPoint, Route, Stop

# 정차 판단 기준
STOP_RADIUS_M = 50.0       # 이 반경 안에 머무르면 같은 정차 후보
STOP_MIN_SECONDS = 300.0   # 최소 5분 이상 머물러야 정차로 인정


def _haversine_m(a: LocationPoint, b: LocationPoint) -> float:
    """두 좌표 사이 거리(m)."""
    r = 6_371_000
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


def build_route(points: list[LocationPoint]) -> Route:
    """좌표열 -> Route (총거리, 총시간, 정차 지점)."""
    if len(points) < 2:
        return Route()

    distance = sum(_haversine_m(points[i], points[i + 1]) for i in range(len(points) - 1))
    duration = (points[-1].time - points[0].time).total_seconds()
    stops = _detect_stops(points)

    return Route(distance_m=int(distance), duration_sec=int(duration), stops=stops)


def _detect_stops(points: list[LocationPoint]) -> list[Stop]:
    """일정 반경 안에 STOP_MIN_SECONDS 이상 머문 구간을 정차로 검출."""
    stops: list[Stop] = []
    i = 0
    n = len(points)
    while i < n:
        j = i + 1
        # i 를 기준점으로, 반경 안에 있는 연속 지점을 j 까지 확장
        while j < n and _haversine_m(points[i], points[j]) <= STOP_RADIUS_M:
            j += 1

        cluster = points[i:j]
        if len(cluster) >= 2:
            dwell = (cluster[-1].time - cluster[0].time).total_seconds()
            if dwell >= STOP_MIN_SECONDS:
                lat = sum(p.lat for p in cluster) / len(cluster)
                lng = sum(p.lng for p in cluster) / len(cluster)
                stops.append(Stop(
                    lat=lat, lng=lng,
                    arrived_at=cluster[0].time,
                    left_at=cluster[-1].time,
                ))
                i = j
                continue
        i += 1

    return stops
