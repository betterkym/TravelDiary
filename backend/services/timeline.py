"""경로와 사진 매칭 -> 시간순 타임라인. (소유: 5번 다이어리 생성)

대표사진을 촬영시간·위치 기준으로 경로/정차 지점에 붙여 시간순 엔트리를 만듭니다.

완료 기준: 고정 데이터 없이 실제 입력으로 3~8개 타임라인 생성, 시간·GPS 누락도 처리.
"""
from __future__ import annotations

from ..models import Photo, Route, SelectedPhoto, TimelineEntry


def build(
    route: Route,
    selected: list[SelectedPhoto],
    photos: list[Photo],
) -> list[TimelineEntry]:
    """경로 + 대표사진 -> 시간순 TimelineEntry 목록.

    TODO(5번):
      - 대표사진을 촬영시간순 정렬
      - 각 사진을 가장 가까운 정차 지점(place)에 매칭
      - 시간/GPS 가 없는 사진도 순서만으로 배치(누락 처리)
    현재는 대표사진을 그대로 엔트리로 나열하는 골격입니다.
    """
    photo_by_id = {p.photo_id: p for p in photos}
    entries: list[TimelineEntry] = []

    for sp in selected:
        p = photo_by_id.get(sp.photo_id)
        entries.append(
            TimelineEntry(
                time=(p.taken_at if p and p.taken_at else None) or _placeholder_time(),
                place="장소 미정",          # TODO(5번): 정차 지점 이름으로 채우기
                note="",                      # diary.py 가 문구를 채웁니다
                photo_url=sp.photo_url,
                lat=p.lat if p else None,
                lng=p.lng if p else None,
            )
        )
    return entries


def _placeholder_time():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)
