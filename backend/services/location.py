"""좌표 검증·정렬·이상치 제거. (소유: 3번 GPS·경로)

브라우저 Geolocation 은 튀는 좌표(정확도 낮음, 순간이동)를 포함하므로
경로 계산 전에 먼저 정리합니다.

완료 기준: 샘플 좌표에서 정리된 좌표열을 반환하고, 좌표 누락에도 중단되지 않음.
"""
from __future__ import annotations

from ..models import LocationPoint


def clean(points: list[LocationPoint]) -> list[LocationPoint]:
    """시간순 정렬 + 명백한 이상치 제거.

    TODO(3번):
      - accuracy_m 가 너무 큰 지점 제외
      - 연속 지점 간 속도가 비현실적이면(순간이동) 제외
      - 동일 위치 중복 제거
    현재는 시간순 정렬만 수행하는 안전한 통과 구현입니다.
    """
    if not points:
        return []
    return sorted(points, key=lambda p: p.time)
