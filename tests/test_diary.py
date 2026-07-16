"""5번 다이어리 - diary.annotate / make_title 테스트. (소유: 최고은 @cge030809)"""
from datetime import datetime, timezone

from backend.models import TimelineEntry
from backend.services import diary


def test_annotate_fills_empty_notes():
    entry = TimelineEntry(time=datetime.now(timezone.utc), place="서울", note="")
    out = diary.annotate([entry])
    assert out[0].note  # 비어 있던 note 가 채워짐


def test_fallback_notes_vary_by_place_type():
    base = datetime(2025, 8, 11, 12, 0, tzinfo=timezone.utc)
    entries = [
        TimelineEntry(time=base, place="마드리드 도심", note="", photo_count=2),
        TimelineEntry(time=base, place="생제르맹 카페", note="", photo_count=2),
        TimelineEntry(time=base, place="마르세유 해안길", note="", photo_count=2),
        TimelineEntry(time=base, place="호텔 레지나 앞", note="", photo_count=2),
        TimelineEntry(time=base, place="파리 라운지", note="", photo_count=1),
    ]

    notes = [entry.note for entry in diary.annotate(entries)]

    assert len(set(notes)) == len(notes)
    assert all("소중한 순간" not in note and "인상적" not in note for note in notes)
    assert any("커피" in note or "휴식" in note for note in notes)
    assert any("해안" in note or "햇빛" in note for note in notes)


def test_make_title_uses_region():
    assert "부산" in diary.make_title([], region="부산")


# TODO(5번): AI 문구 생성 성공/실패(fallback) 분기 테스트 추가
