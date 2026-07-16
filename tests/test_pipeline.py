"""End-to-end pipeline smoke tests."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend import storage
from backend.app import app
from backend.models import Photo

client = TestClient(app)


def test_full_flow_returns_diary_shape():
    r = client.post(
        "/api/trips",
        json={
            "title": "테스트 여행",
            "start_date": "2026-07-15",
            "region": "서울",
        },
    )
    assert r.status_code == 200
    trip_id = r.json()["trip_id"]

    now = datetime.now(timezone.utc)
    r = client.post(
        f"/api/trips/{trip_id}/locations",
        json={
            "points": [
                {"lat": 37.0, "lng": 127.0, "time": now.isoformat()},
                {"lat": 37.001, "lng": 127.001, "time": (now + timedelta(minutes=30)).isoformat()},
            ]
        },
    )
    assert r.status_code == 200

    r = client.post(f"/api/trips/{trip_id}/generate")
    assert r.status_code == 200
    diary = r.json()

    assert diary["trip_id"] == trip_id
    assert "route" in diary and "distance_m" in diary["route"]
    assert "selected_photos" in diary
    assert "timeline" in diary

    r = client.get(f"/api/trips/{trip_id}/diary")
    assert r.status_code == 200
    assert r.json()["trip_id"] == trip_id

    r = client.get(f"/api/trips/{trip_id}/locations")
    assert r.status_code == 200
    assert len(r.json()["locations"]) == 2


def test_generate_prefers_photo_gps_over_manual_locations():
    r = client.post(
        "/api/trips",
        json={
            "title": "사진 우선",
            "start_date": "2026-07-15",
            "region": "서울",
        },
    )
    assert r.status_code == 200
    trip_id = r.json()["trip_id"]

    now = datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc)
    client.post(
        f"/api/trips/{trip_id}/locations",
        json={
            "points": [
                {"lat": 37.0, "lng": 127.0, "time": now.isoformat()},
                {"lat": 38.0, "lng": 128.0, "time": (now + timedelta(hours=1)).isoformat()},
            ]
        },
    )

    storage.add_photos(
        trip_id,
        [
            Photo(photo_id="p1", filename="p1.jpg", taken_at=now, lat=37.0, lng=127.0),
            Photo(photo_id="p2", filename="p2.jpg", taken_at=now + timedelta(minutes=2), lat=37.001, lng=127.001),
            Photo(photo_id="p3", filename="p3.jpg", taken_at=now + timedelta(minutes=6), lat=37.001, lng=127.001),
        ],
    )

    r = client.post(f"/api/trips/{trip_id}/generate")
    assert r.status_code == 200
    diary = r.json()

    assert diary["route"]["duration_sec"] == 360
    assert diary["route"]["distance_m"] < 1000
    assert len(diary["route"]["stops"]) == 1


def test_list_trips_returns_saved_diaries_for_calendar_sync():
    trip_ids = []
    for title, start_date, offset in [
        ("모바일 동기화 1", "2026-07-10", 0),
        ("모바일 동기화 2", "2026-07-11", 1),
    ]:
        r = client.post(
            "/api/trips",
            json={
                "title": title,
                "start_date": start_date,
                "region": "서울",
            },
        )
        assert r.status_code == 200
        trip_id = r.json()["trip_id"]
        trip_ids.append((trip_id, start_date))

        when = datetime(2026, 7, 10 + offset, 9, 0, tzinfo=timezone.utc)
        r = client.post(
            f"/api/trips/{trip_id}/locations",
            json={
                "points": [
                    {"lat": 37.5 + offset * 0.01, "lng": 127.0, "time": when.isoformat()},
                    {"lat": 37.501 + offset * 0.01, "lng": 127.001, "time": (when + timedelta(minutes=20)).isoformat()},
                ]
            },
        )
        assert r.status_code == 200

        storage.add_photos(
            trip_id,
            [
                Photo(
                    photo_id=f"sync_{offset}_1",
                    filename=f"sync_{offset}_1.jpg",
                    taken_at=when,
                    lat=37.5 + offset * 0.01,
                    lng=127.0,
                ),
                Photo(
                    photo_id=f"sync_{offset}_2",
                    filename=f"sync_{offset}_2.jpg",
                    taken_at=when + timedelta(minutes=5),
                    lat=37.501 + offset * 0.01,
                    lng=127.001,
                ),
            ],
        )

        r = client.post(f"/api/trips/{trip_id}/generate")
        assert r.status_code == 200

    r = client.get("/api/trips")
    assert r.status_code == 200
    trips = r.json()["trips"]
    trips_by_id = {trip["trip_id"]: trip for trip in trips}

    for trip_id, start_date in trip_ids:
        assert trip_id in trips_by_id
        assert trips_by_id[trip_id]["date"] == start_date
        assert trips_by_id[trip_id]["diary"]["timeline"]
        assert len(trips_by_id[trip_id]["locations"]) == 2


def test_latest_trip_ignores_empty_drafts():
    now = datetime(2026, 7, 16, 9, 0, tzinfo=timezone.utc)
    ready = client.post(
        "/api/trips",
        json={
            "title": "완성된 여행",
            "start_date": "2026-07-16",
            "region": "서울",
        },
    )
    assert ready.status_code == 200
    ready_id = ready.json()["trip_id"]
    client.post(
        f"/api/trips/{ready_id}/locations",
        json={
            "points": [
                {"lat": 37.0, "lng": 127.0, "time": now.isoformat()},
                {"lat": 37.001, "lng": 127.001, "time": (now + timedelta(minutes=5)).isoformat()},
            ]
        },
    )
    assert client.post(f"/api/trips/{ready_id}/generate").status_code == 200

    draft = client.post(
        "/api/trips",
        json={
            "title": "빈 여행",
            "start_date": "2026-07-17",
            "region": "서울",
        },
    )
    assert draft.status_code == 200

    latest = client.get("/api/trips/latest")

    assert latest.status_code == 200
    assert latest.json()["trip_id"] == ready_id


def test_unknown_trip_404():
    assert client.get("/api/trips/nope/diary").status_code == 404
