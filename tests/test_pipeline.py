"""전체 흐름 스모크 테스트. (소유: 2번 백엔드·통합)

하위 모듈이 stub 이어도 여행 생성 -> 좌표 -> generate -> diary 가
공통 데이터 계약(Diary) 형태로 끝까지 도는지 확인합니다.

실행: pytest
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_full_flow_returns_diary_shape():
    # 1) 여행 생성
    r = client.post("/api/trips", json={
        "title": "테스트 여행",
        "start_date": "2026-07-15",
        "region": "서울",
    })
    assert r.status_code == 200
    trip_id = r.json()["trip_id"]

    # 2) 좌표 전송
    now = datetime.now(timezone.utc)
    r = client.post(f"/api/trips/{trip_id}/locations", json={
        "points": [
            {"lat": 37.0, "lng": 127.0, "time": now.isoformat()},
            {"lat": 37.001, "lng": 127.001, "time": (now + timedelta(minutes=30)).isoformat()},
        ]
    })
    assert r.status_code == 200

    # 3) 생성
    r = client.post(f"/api/trips/{trip_id}/generate")
    assert r.status_code == 200
    diary = r.json()

    # 공통 데이터 계약 키 확인
    assert diary["trip_id"] == trip_id
    assert "route" in diary and "distance_m" in diary["route"]
    assert "selected_photos" in diary
    assert "timeline" in diary

    # 4) 재조회
    r = client.get(f"/api/trips/{trip_id}/diary")
    assert r.status_code == 200
    assert r.json()["trip_id"] == trip_id


def test_unknown_trip_404():
    assert client.get("/api/trips/nope/diary").status_code == 404
