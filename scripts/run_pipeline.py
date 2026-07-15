"""서버 없이 파이프라인을 1회 관통시켜 outputs/result.json 을 만든다.

각 담당자가 자기 모듈을 채운 뒤, 웹서버를 띄우지 않고도 전체 흐름을
빠르게 확인하는 용도입니다. (좌표/사진은 더미 데이터로 채웁니다.)

실행:
    python -m scripts.run_pipeline
"""
from __future__ import annotations

from datetime import datetime, timezone

from backend import config, pipeline, storage
from backend.models import LocationPoint, Photo, TripCreate


def main() -> None:
    trip_id = "trip_demo"

    # 1) 더미 여행 + 좌표 2개 + 사진 10장
    storage.create_trip(trip_id, TripCreate(title="데모 여행", start_date="2026-07-15", region="서울"))
    now = datetime(2026, 7, 15, 10, tzinfo=timezone.utc)
    storage.add_locations(trip_id, [
        LocationPoint(lat=37.5665, lng=126.9780, time=now),
        LocationPoint(lat=37.5700, lng=126.9830, time=now.replace(hour=11)),
    ])
    storage.add_photos(trip_id, [
        Photo(photo_id=f"p{i:02d}", filename=f"photo_{i:02d}.jpg") for i in range(10)
    ])

    # 2) 파이프라인 관통 (3·4·5번 모듈 전부 통과)
    diary = pipeline.generate(trip_id)

    # 3) 결과 저장
    out = config.OUTPUT_DIR / "result.json"
    out.write_text(diary.model_dump_json(indent=2), encoding="utf-8")

    print(f"[OK] {out}")
    print(f"     경로 {diary.route.distance_m}m / 대표사진 {len(diary.selected_photos)}장 / 타임라인 {len(diary.timeline)}개")


if __name__ == "__main__":
    main()
