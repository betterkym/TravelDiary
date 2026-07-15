# 팀원 개인 맞춤 작업 안내

각자 아래 자기 섹션만 보면 됩니다. **공통 규칙**을 먼저 읽고 시작하세요.

## 공통 규칙 (모두 필수)

1. **받기** (한 번만): `git clone https://github.com/cge030809-debug/TravelDiary.git`
   - 기준 브랜치는 `master` 입니다. `main` 아님. (자세한 건 README 맨 위 "팀원 초기 설정")
2. **내 브랜치 만들기**: `git checkout master && git pull` → `git checkout -b feat/내-브랜치`
3. **내 소유 파일만 수정**합니다. 함수의 **이름·인자·반환 타입은 그대로 두고 내용만** 채웁니다. (`pipeline.py` 가 이 시그니처로 부름)
4. **테스트를 켜 두고 작업**: `pytest -q` 가 계속 통과하도록. 자기 모듈 테스트 파일의 `TODO` 도 채웁니다.
5. **작게 자주 PR**: 하나의 PR엔 하나의 기능. PR 올리기 전 `git checkout master && git pull` → 내 브랜치에서 `git merge master`.

개발 환경:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q                       # 전체 테스트
python -m scripts.run_pipeline  # 서버 없이 파이프라인 관통 → outputs/result.json
uvicorn backend.app:app --reload  # 서버 (http://localhost:8000/docs)
```

---

## 1. UI·프런트 — 윤현정 (@keepwatering)

- **브랜치**: `feat/ui-flow`
- **소유 파일**: `index.html`, `styles.css`, `app.js`

**할 일**
- 사진 다중 업로드 UI (JPEG/PNG 10~30장 선택)
- 분석 진행 상태 / 오류 표시
- `app.js` 의 고정 탈린 샘플 데이터(`state.timeline` 하드코딩) 제거
- 백엔드 API를 `fetch` 로 연결해 **실제 결과**를 지도·다이어리에 렌더링

**연결할 API** (백엔드 로컬 `uvicorn` 띄운 상태에서)
```
POST /api/trips                      → { trip_id }
POST /api/trips/{trip_id}/locations  → 좌표 배열 전송
POST /api/trips/{trip_id}/photos     → 사진 multipart 업로드
POST /api/trips/{trip_id}/generate   → 다이어리 생성 (Diary JSON)
GET  /api/trips/{trip_id}/diary      → 다이어리 재조회
```
- 응답(Diary) 형태는 README "공통 데이터 계약" 참고. `timeline[].photo_url`, `place`, `note`, `lat/lng` 를 화면에 그리면 됨.

**완료 기준**: 모바일에서 `여행 생성 → 위치 기록 → 사진 업로드 → 실제 결과 렌더링`이 이어지고, 고정 탈린 데이터가 사라짐.

---

## 3. GPS·경로 — 정가희 (@jghkor-ctrl)

- **브랜치**: `feat/route-processing`
- **소유 파일**: `backend/services/location.py`, `route.py` + `tests/test_location.py`, `test_route.py`

**채울 함수 (시그니처 고정)**
```python
# location.py
def clean(points: list[LocationPoint]) -> list[LocationPoint]: ...
# route.py
def build_route(points: list[LocationPoint]) -> Route: ...
```

**Phase 2 목표**
- `clean`: accuracy_m 너무 큰 지점 제외 / 연속 지점 속도가 비현실적이면(순간이동) 제외 / 동일 위치 중복 제거
- `build_route`: 정차 지점 검출(일정 반경 안에 오래 머문 구간) → `Route.stops` 에 3~5개 채우기. (거리 계산용 `_haversine_m` 은 이미 있음)

**완료 기준**: 샘플 좌표에서 경로 요약 + 정차 지점 3~5개 반환, 좌표 누락에도 안 멈춤. `test_route.py` 의 `TODO`(stops) 테스트 추가.

---

## 4. 사진 분석·선별 — 이주현 (@jhlee0219)

- **브랜치**: `feat/photo-curation`
- **소유 파일**: `backend/services/exif.py`, `quality.py`, `dedupe.py`, `selector.py` + 대응 테스트 4개

**채울 함수 (시그니처 고정) — 이 순서가 파이프라인 순서**
```python
def extract(path: Path) -> Photo: ...                 # exif.py
def score(photo: Photo, path: Path) -> Photo: ...     # quality.py  (quality_score 채움)
def group(photos, paths) -> list[Photo]: ...          # dedupe.py   (group_id 채움)
def select(photos, max_count=8) -> list[SelectedPhoto]: ...  # selector.py
```

**Phase 2 목표**
- `exif`: Pillow 로 EXIF 파싱 → `taken_at`, `lat`, `lng`, `width`, `height`. 방향(Orientation) 보정 고려. (GPS 원문·EXIF 전체는 로그에 남기지 말 것)
- `quality`: 라플라시안 분산으로 흐림, 히스토그램으로 노출, 작은 해상도 감점 → `quality_score` 0~1
- `dedupe`: `ImageHash`(perceptual hash) 해밍 거리로 유사사진 묶기 → 같은 `group_id`
- `selector`: 그룹마다 최고 품질 1장 → 품질순 상위 8장. `reason` 에 근거 기록

**완료 기준**: 실제 사진 10~30장 → 대표사진 최대 8장 + 점수·이유 JSON. 테스트 4개의 `TODO` 채우기.

---

## 5. 다이어리 생성 — 최고은 (@cge030809)

- **브랜치**: `feat/diary-generation`
- **소유 파일**: `backend/services/timeline.py`, `diary.py`, `prompts/curator.txt` + `tests/test_timeline.py`, `test_diary.py`

**채울 함수 (시그니처 고정)**
```python
# timeline.py
def build(route, selected, photos) -> list[TimelineEntry]: ...
# diary.py
def annotate(entries) -> list[TimelineEntry]: ...       # 각 note 채움
def make_title(entries, region="") -> str: ...          # 여행 제목
```

**Phase 2 목표**
- `timeline.build`: 대표사진을 촬영시간순 정렬 → 가장 가까운 정차 지점(place)에 매칭. 시간/GPS 누락 사진도 순서만으로 배치
- `diary.annotate`: `prompts/curator.txt` 로 AI 문구 생성, 실패/키없음 시 `_fallback_note` 로 대체
- AI 키는 서버에서만(`config.AI_API_KEY`), 최소 데이터만 전달

**완료 기준**: 고정 데이터 없이 실제 입력으로 3~8개 타임라인, 시간·GPS 누락도 처리. 테스트 2개의 `TODO` 채우기.

---

## 병합 순서 (통합 담당 @betterkym 이 관리)

1. 3번(경로) · 4번(사진) — 서로 독립, 먼저 병합
2. 5번(다이어리) — 3·4 결과 위에서 작업 후 병합
3. 1번(UI) — 실제 API 준비되면 연결
4. 통합 담당이 전체 흐름·오류 케이스 통합 테스트
