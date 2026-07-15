"""전체 파이프라인 연결. (소유: 2번 백엔드·통합)

3·4·5번 모듈을 순서대로 호출해 최종 Diary(공통 데이터 계약)를 만듭니다.

    좌표 정리(3) -> 경로 계산(3)
    EXIF(4) -> 품질(4) -> 유사사진(4) -> 대표사진(4)
    매칭/타임라인(5) -> 문구(5)

각 모듈이 stub 이어도 전체 흐름이 끝까지 돌아가도록 설계했습니다.
"""
from __future__ import annotations

from pathlib import Path

from . import config, storage
from .models import Diary
from .services import dedupe, diary, exif, location, quality, route, selector, timeline


def generate(trip_id: str) -> Diary:
    """저장된 좌표·사진으로 다이어리를 생성하고 저장 후 반환."""
    # 1) 경로 (3번)
    raw_points = storage.get_locations(trip_id)
    clean_points = location.clean(raw_points)
    trip_route = route.build_route(clean_points)

    # 2) 사진 (4번): exif -> quality -> dedupe -> selector
    photos = storage.get_photos(trip_id)
    paths: dict[str, Path] = {p.photo_id: config.UPLOAD_DIR / p.filename for p in photos}
    for p in photos:
        quality.score(p, paths[p.photo_id])
    photos = dedupe.group(photos, paths)
    selected = selector.select(photos)

    # 3) 다이어리 (5번): 매칭 -> 문구
    entries = timeline.build(trip_route, selected, photos)
    entries = diary.annotate(entries)

    result = Diary(
        trip_id=trip_id,
        route=trip_route,
        selected_photos=selected,
        timeline=entries,
    )
    storage.save_diary(trip_id, result)
    return result
