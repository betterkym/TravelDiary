"""5번 다이어리 - diary.annotate / make_title 테스트. (소유: 최고은 @cge030809)"""
from datetime import datetime, timezone

from backend.models import TimelineEntry
from backend.services import diary


def test_annotate_fills_empty_notes():
    entry = TimelineEntry(time=datetime.now(timezone.utc), place="서울", note="")
    out = diary.annotate([entry])
    assert out[0].note  # 비어 있던 note 가 채워짐


def test_make_title_uses_region():
    assert "부산" in diary.make_title([], region="부산")


# TODO(5번): AI 문구 생성 성공/실패(fallback) 분기 테스트 추가
