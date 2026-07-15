"""거리·시간·정차 지점 계산. (소유: 3번 GPS·경로)

정리된 좌표열로부터 경로 요약(Route)을 만듭니다.

완료 기준: 샘플 좌표에서 경로 요약과 정차 지점 3~5개를 반환.
"""
from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt

from ..models import LocationPoint, Route, Stop


def _haversine_m(a: LocationPoint, b: LocationPoint) -> float:
    """두 좌표 사이 거리(m)."""
    r = 6_371_000
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


def build_route(points: list[LocationPoint]) -> Route:
    """좌표열 -> Route.

    TODO(3번):
      - 정차 지점 검출(일정 반경 내 오래 머문 구간) -> stops
      - 필요하면 geocoding 으로 stop 에 place 이름 채우기
    현재는 총거리/총시간만 계산하고 stops 는 비웁니다.
    """
    if len(points) < 2:
        return Route()

    distance = sum(_haversine_m(points[i], points[i + 1]) for i in range(len(points) - 1))
    duration = (points[-1].time - points[0].time).total_seconds()

    stops: list[Stop] = []  # TODO(3번): 정차 지점 채우기

    return Route(distance_m=int(distance), duration_sec=int(duration), stops=stops)
