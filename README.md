# Travel Diary MVP

여행 중 기록한 이동 경로와 여행 후 쌓인 사진을 연결해, 대표 장면과 시간순 여행 다이어리로 자동 정리하는 웹 서비스 MVP입니다.

> 현재 저장소는 완성된 AI 서비스가 아니라 **프런트엔드 인터랙션 프로토타입**입니다.  
> 여행 생성, 지도 표시, 실시간 위치 추적, 기록 시작·종료, 다이어리 화면 전환까지 구현되어 있습니다. 사진 업로드·저장·분석·AI 선별·실제 다이어리 생성은 아직 구현되지 않았습니다.

## ⚠️ 팀원 초기 설정 (한 번만, 반드시 읽기)

이 저장소의 기준 브랜치는 **`master`** 입니다. `main` 이 아닙니다.  
`git init` 으로 폴더를 직접 만들면 로컬이 `main` 이 되어 **`git pull` 을 해도 아무것도 안 바뀝니다.** 반드시 아래처럼 **`git clone`** 으로 받으세요.

```bash
# 1) 저장소 통째로 받기 (init 하지 말 것)
git clone https://github.com/cge030809-debug/TravelDiary.git
cd TravelDiary

# 2) 내 담당 브랜치 만들기 (아래 '5인 업무 분담' 표의 브랜치 이름 사용)
git checkout -b feat/내-브랜치        # 예: feat/photo-curation
```

### 이미 받았는데 "pull 해도 안 바뀌는" 경우

로컬이 `main` 에 묶여 있는 것이 원인입니다. 아래로 고칩니다.

```bash
git branch                 # main 이라고 나오면 이게 원인
git fetch origin
git checkout master        # 실제 코드가 있는 브랜치로 이동 → 여기서 backend/ 폴더가 생김
git pull origin master
git checkout -b feat/내-브랜치
```

### 정상 확인

```bash
git log --oneline -1       # "Merge pull request #1 ..." 이 보이면 최신입니다
ls backend/                # app.py, models.py, services/ 등이 보이면 정상
```

> 앞으로 작업 시작 전·PR 전에는 항상 `git checkout master && git pull` 로 최신을 받은 뒤, 자기 브랜치에서 `git merge master` 로 맞춰주세요. 자세한 규칙은 아래 [충돌 방지 규칙](#충돌-방지-규칙) 참고.

## 해결하려는 문제

여행이 끝난 뒤 사진은 수백 장 남지만, 중복 사진을 정리하고 대표 장면을 고르고 시간순 기록으로 만드는 일은 대부분 미뤄집니다.

Travel Diary의 목표는 다음 과정을 하나의 흐름으로 연결하는 것입니다.

```text
이동 경로 기록
→ 여행 사진 업로드
→ 촬영정보·품질 분석
→ 유사사진 정리와 대표사진 선별
→ 경로와 사진 매칭
→ 시간순 여행 다이어리 생성
```

## 첫 번째 MVP 범위

첫 MVP는 500~1,000장을 완벽하게 처리하는 서비스가 아닙니다. 우선 아래 흐름이 실제 데이터로 끝까지 작동하는 것을 목표로 합니다.

1. 여행 제목·날짜·지역을 입력합니다.
2. 여행 중 브라우저 위치정보로 이동 경로를 기록합니다.
3. 여행 종료 후 JPEG/PNG 사진 10~30장을 직접 선택합니다.
4. 촬영시간·GPS·크기 등 사진 메타데이터를 추출합니다.
5. 흐림·노출·해상도와 유사도를 기준으로 대표사진을 최대 8장 고릅니다.
6. 기록된 경로와 사진을 시간·위치 기준으로 연결합니다.
7. 실제 사진이 들어간 시간순 다이어리를 화면에 표시합니다.

## 현재 구현 상태

### 구현됨

- 여행 제목·날짜·지역 입력 화면
- 여행 생성 화면, 지도 화면, 다이어리 화면 전환
- Mapbox GL JS 지도 초기화 로직
- 브라우저 Geolocation API를 이용한 현재 위치 추적
- 이동거리 12m 또는 8초 간격의 발자국 마커 표시
- 기록 경과시간 타이머
- 위치 권한 및 지도 토큰 오류 안내
- 기록 시작·종료 인터랙션
- 모바일 화면 중심의 반응형 UI
- 타임라인 카드 렌더링 UI

### 현재 데모 데이터

현재 `app.js`의 탈린 여행과 타임라인은 실제 분석 결과가 아니라 고정된 샘플입니다.

- 장소·시간·문구가 `state.timeline`에 하드코딩되어 있습니다.
- 사진처럼 보이는 이미지는 실제 사진이 아니라 브라우저에서 만든 SVG입니다.
- 기록한 GPS 좌표는 화면의 마커로만 사용되고 배열이나 서버에 저장되지 않습니다.
- 기록 종료 시 사진·경로 분석 없이 샘플 다이어리가 바로 열립니다.
- 새로고침하면 여행 정보와 위치 기록이 사라집니다.
- `지도에서 보기`는 해당 장소로 이동하지 않고 지도 화면만 엽니다.

### 아직 구현되지 않음

- Python 백엔드와 API
- 여행 및 GPS 좌표 저장
- 사진 다중 업로드
- 이미지 파일 검증·정규화
- EXIF 촬영시간·GPS 추출
- 흔들림·노출·해상도 평가
- 중복·유사사진 그룹화
- 대표사진 자동 선별
- 사진과 이동 경로 매칭
- 실제 장소·사진 기반 타임라인
- AI 제목·문구 생성
- 결과 저장·수정·공유
- 테스트와 배포 환경

## 현재 데모 흐름

```text
여행 정보 입력
→ 여행 시작
→ 지도 화면
→ 기록 시작
→ 위치 권한 허용
→ 현재 위치와 발자국 표시
→ 기록 종료
→ 샘플 다이어리 화면
```

현재 지도에서 수집한 위치와 샘플 다이어리는 서로 연결되어 있지 않습니다.

## 5인 업무 분담

현재 코드 기준으로 아래 분담이 가장 현실적입니다. UI 담당도 단순 디자인이 아니라 실제 API 연결까지 맡기 때문에 업무량이 충분합니다.

| 담당 | 담당자 (GitHub) | 핵심 업무 | 소유 영역 | 브랜치 |
|---|---|---|---|---|
| 1. UI·프런트 | 윤현정 (@keepwatering) | 사진 업로드, 진행·오류 상태, 실제 결과 렌더링, 고정 탈린 데이터 제거 | `index.html`, `styles.css`, `app.js` | `feat/ui-flow` |
| 2. 백엔드·통합 | 김나은 (@betterkym) | Python 서버, API, 저장, 공통 모델, 전체 파이프라인 연결, README | `backend/app.py`, `models.py`, `config.py`, `storage.py`, `pipeline.py`, 공용 파일 | `feat/backend-api` |
| 3. GPS·경로 | 정가희 (@jghkor-ctrl) | 좌표 정렬·이상치 제거, 거리·시간·정차 지점 계산 | `backend/services/location.py`, `route.py` | `feat/route-processing` |
| 4. 사진 분석·선별 | 이주현 (@jhlee0219) | EXIF, 흐림·노출 평가, 유사사진 묶기, 대표사진 최대 8장 선택 | `backend/services/exif.py`, `quality.py`, `dedupe.py`, `selector.py` | `feat/photo-curation` |
| 5. 다이어리 생성 | 최고은 (@cge030809) | 경로와 사진 매칭, 시간순 타임라인, 제목·문구, AI 실패 시 대체 문장 | `backend/services/timeline.py`, `diary.py`, `prompts/curator.txt` | `feat/diary-generation` |

사진 담당을 더 쪼개지 않은 이유는 **EXIF → 품질평가 → 유사사진 → 대표사진**이 하나의 연속된 파이프라인이기 때문입니다. 반면 GPS는 사진과 별도로 검증할 수 있고, 현재 서비스의 지도 기능을 실제 데이터로 바꾸려면 전담자가 필요합니다.

실력 배치는 다음을 권장합니다.

- 가장 Python·Git에 익숙한 사람: 2번
- 이미지 처리나 알고리즘에 강한 사람: 4번
- 디자인·사용자 흐름에 강한 사람: 1번
- 데이터 정리·계산에 강한 사람: 3번
- 기획 의도를 잘 이해하고 문구·구성 감각이 있는 사람: 5번

2번 담당자는 `models.py`, `requirements.txt`, `.env.example`, `.gitignore`, `README.md` 등 공용 파일을 관리합니다. 나머지 담당자는 공용 파일 변경이 필요하면 직접 수정하기보다 Pull Request 설명에 요청사항을 남깁니다.

## 충돌 방지 규칙

5명이 동시에 작업해도 병합 충돌이 나지 않도록, 아래 규칙을 지킵니다. 핵심은 **각자 자기 소유 파일만 수정한다**입니다.

### 1. 소유 파일만 수정

- 위 분담표의 `소유 영역`에 있는 파일만 직접 수정합니다.
- 서비스 파일은 `backend/services/` 안에서 **서로 다른 파일**을 담당하므로, 같은 폴더라도 파일이 다르면 충돌하지 않습니다.
- 남의 파일 수정이 필요하면 직접 고치지 말고, 그 파일 소유자에게 요청하거나 PR 설명에 남깁니다. `.github/CODEOWNERS` 가 파일별 리뷰어를 자동 지정합니다.

### 2. 공통 계약은 2번만 변경

- `backend/models.py`(데이터 형식)와 아래 **함수 시그니처**는 모두가 의존하는 계약입니다. 2번만 변경하며, 바뀌면 팀에 즉시 공유합니다.
- 3·4·5번은 함수의 **이름·인자·반환 타입은 그대로 두고 내용(body)만** 채웁니다. 시그니처를 바꿔야 하면 먼저 2번과 상의합니다(`pipeline.py` 가 이 시그니처로 호출하기 때문).

| 파일 | 유지해야 하는 시그니처 |
|---|---|
| `services/location.py` | `clean(points) -> list[LocationPoint]` |
| `services/route.py` | `build_route(points) -> Route` |
| `services/exif.py` | `extract(path) -> Photo` |
| `services/quality.py` | `score(photo, path) -> Photo` |
| `services/dedupe.py` | `group(photos, paths) -> list[Photo]` |
| `services/selector.py` | `select(photos, max_count) -> list[SelectedPhoto]` |
| `services/timeline.py` | `build(route, selected, photos) -> list[TimelineEntry]` |
| `services/diary.py` | `annotate(entries) -> list[TimelineEntry]`, `make_title(entries, region) -> str` |

### 3. 브랜치·PR 규칙

- 작업 시작 전과 PR 올리기 직전에 항상 최신 `master` 를 받아옵니다.
  ```bash
  git checkout master && git pull
  git checkout feat/내-브랜치
  git merge master        # 또는 git rebase master
  ```
- 자기 기능 브랜치(위 표의 `브랜치`)에서만 작업하고, `master` 에 직접 커밋하지 않습니다.
- 하나의 PR에는 하나의 기능 단위만 담고, 작게 자주 올립니다.
- PR은 자기 소유 파일만 바꿔야 합니다. 공용 파일이 섞이면 2번에게 알립니다.

### 4. 병합 순서

충돌 위험을 줄이려면 아래 순서로 병합합니다.

1. 2번 스켈레톤(`feat/backend-api`)을 `master` 에 먼저 병합 → 나머지가 여기서 분기
2. 3번(경로) · 4번(사진)은 서로 독립적이라 순서 무관하게 병합
3. 5번(다이어리)은 3·4번 병합 후 그 결과를 이용
4. 1번(UI)은 실제 API가 준비되면 마지막에 연결
5. 2번이 전체 흐름과 오류 케이스를 통합 테스트

### 예정 API

```text
POST /api/trips
POST /api/trips/{trip_id}/locations
POST /api/trips/{trip_id}/photos
POST /api/trips/{trip_id}/generate
GET  /api/trips/{trip_id}/diary
```

## 공통 데이터 계약

5명이 동시에 개발하기 전에 2번 담당자가 아래 데이터 형식을 먼저 확정합니다. 각 담당자는 실제 모듈이 완성되기 전에도 동일한 형태의 fixture JSON으로 개발합니다.

```json
{
  "trip_id": "trip_001",
  "title": "서울 여행 기록",
  "route": {
    "distance_m": 3120,
    "duration_sec": 7200,
    "stops": []
  },
  "selected_photos": [],
  "timeline": [
    {
      "time": "2026-07-15T10:30:00+09:00",
      "place": "장소명",
      "note": "짧은 여행 기록",
      "photo_url": "/outputs/photo_01.jpg",
      "lat": 37.0,
      "lng": 127.0
    }
  ]
}
```

## 협업 순서

1. 2번 담당자가 프로젝트 폴더, 공통 모델, API 스키마와 stub을 먼저 만듭니다.
2. 1·3·4·5번 담당자는 동일한 fixture JSON을 사용해 병렬 작업합니다.
3. 3번 경로 모듈과 4번 사진 모듈을 먼저 병합합니다.
4. 5번이 두 결과를 결합해 다이어리 JSON을 완성합니다.
5. 1번이 실제 API 결과를 화면에 연결합니다.
6. 2번이 전체 흐름과 오류 케이스를 통합 테스트합니다.

## 기술 스택

| 영역 | 기술 | 상태 |
|---|---|---|
| 화면 | HTML5, CSS3 | 구현됨 |
| 화면 동작 | Vanilla JavaScript | 구현됨 |
| 지도 | Mapbox GL JS 3.26.0 | 기본 로직 구현됨 |
| 위치 추적 | Web Geolocation API | 기본 로직 구현됨 |
| 서버 | Python API 서버 | 예정 |
| 사진 메타데이터 | Pillow / EXIF | 예정 |
| 사진 품질 | Pillow 또는 OpenCV | 예정 |
| 유사사진 | perceptual hash | 예정 |
| AI 문구 | 서버 측 AI API | 예정 |
| 테스트 | Pytest | 예정 |

예정 기술은 구현 과정에서 변경될 수 있습니다.

## 프로젝트 구조

### 현재 구조

```text
TravelDiary/
├── index.html
├── styles.css
├── app.js
└── README.md
```

### 확장 예정 구조

```text
TravelDiary/
├── index.html
├── styles.css
├── app.js
│
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── config.py
│   ├── storage.py
│   ├── pipeline.py
│   └── services/
│       ├── location.py
│       ├── route.py
│       ├── exif.py
│       ├── quality.py
│       ├── dedupe.py
│       ├── selector.py
│       ├── timeline.py
│       └── diary.py
│
├── prompts/
│   └── curator.txt
├── tests/
├── uploads/
├── outputs/
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

확장 예정 구조는 팀의 작업 기준이며, 위 파일들이 현재 구현되어 있다는 의미는 아닙니다.

## 현재 프런트 프로토타입 실행

위치 권한과 지도 기능은 브라우저 정책상 `file://`보다 `localhost`에서 안정적으로 작동합니다.

프로젝트 폴더에서 다음 중 하나를 실행합니다.

```bash
python3 -m http.server 8000
```

또는:

```bash
python -m http.server 8000
```

브라우저에서 다음 주소로 접속합니다.

```text
http://localhost:8000
```

백엔드 API는 별도 터미널에서 다음으로 실행합니다.

```bash
uvicorn backend.app:app --reload --port 8001
```

프런트는 `config.local.js`의 `window.API_BASE_URL`을 `http://localhost:8001`로 두면 됩니다.

### Mapbox 토큰

현재 `app.js`는 실행 시 다음 전역값을 읽습니다.

```js
window.MAPBOX_ACCESS_TOKEN
```

이 값은 `app.js`보다 먼저 주입되어야 합니다. 현재 저장소에는 정식 설정 로더가 없으므로, UI·백엔드 통합 과정에서 별도의 로컬 설정 방식을 추가해야 합니다. 실제 토큰은 Git에 커밋하지 마세요.

## 개발 방식 — 얕게 시작해 3단계로 정교화

각 모듈(특히 4·5번의 알고리즘)은 처음부터 정확도를 노리지 않습니다. **전체 흐름이 먼저 관통**된 뒤, 각자 자기 모듈의 `TODO`를 채워 점점 정교화합니다.

- **1단계 (완료됨) — 더미 관통**: 모든 stub 이 계약 형태만 반환. 전체 파이프라인이 끝까지 돌고 `outputs/result.json` 이 생성됨.
- **2단계 — 얕은 실제 기능**: 각 모듈의 실제 로직을 채움. (EXIF 실제 추출, 흐림/노출 점수, 유사사진 묶기, 촬영시간순 매칭 등) 오류가 나도 전체가 멈추지 않게.
- **3단계 — AI 디테일**: 분위기·감정 해석, 대표사진 선택 이유, 제목·문구 생성, 장소명 등 고도화.

> 3단계부터 시작하면 결과는 나와도 구조가 안 잡혀 다시 뜯게 됩니다. 반드시 1→2→3 순서로.

### 로컬에서 파이프라인만 빠르게 돌려보기

서버를 띄우지 않고 전체 흐름을 확인하려면(각자 모듈 채운 뒤 검증용):

```bash
python -m scripts.run_pipeline   # outputs/result.json 생성
pytest                           # 모듈별 테스트 (tests/test_*.py)
```

각 담당자는 `tests/` 안의 **자기 모듈 테스트 파일**(`test_exif.py` 등)을 함께 채워 나갑니다.

## 개발 로드맵

### Phase 0 — 프런트 클릭 데모

- [x] 여행 생성 화면
- [x] 지도·다이어리 화면
- [x] 위치 권한과 현재 위치 표시
- [x] 기록 시작·종료 인터랙션
- [x] 샘플 타임라인 렌더링

### Phase 1 — 실제 데이터 저장

- [ ] Python 서버와 공통 데이터 모델
- [ ] 여행 생성·조회 API
- [ ] GPS 좌표 배열 저장
- [ ] 사진 10~30장 다중 업로드
- [ ] 새로고침 후 여행 복원

### Phase 2 — 사진 정리

- [ ] EXIF 추출과 방향 보정
- [ ] 흐림·노출·해상도 평가
- [ ] 유사사진 그룹화
- [ ] 대표사진 최대 8장 선택

### Phase 3 — 실제 다이어리

- [ ] GPS 경로 정리와 정차 지점 추출
- [ ] 사진과 경로 매칭
- [ ] 실제 사진 기반 타임라인
- [ ] 제목·문구 생성과 fallback
- [ ] 프런트엔드 API 연동

### Phase 4 — 검증과 확장

- [ ] 100~1,000장 성능 검증
- [ ] HEIC·Live Photo 대응
- [ ] 선별 결과 수정 기능
- [ ] 사용자 취향 반영
- [ ] 결과 저장·공유·내보내기
- [ ] 데이터 삭제 정책

## Git 작업 규칙

- `main`에서 직접 작업하지 않습니다.
- 각 담당자는 자신의 기능 브랜치와 소유 파일을 사용합니다.
- 하나의 Pull Request에는 하나의 기능 단위만 포함합니다.
- 공용 파일인 `models.py`, `requirements.txt`, `.gitignore`, `README.md`는 2번 담당자가 관리합니다.
- 다른 담당자의 파일 수정이 필요하면 먼저 공유하고 PR 설명에 이유를 적습니다.
- UI 변경 PR에는 화면 캡처를 첨부합니다.
- API 형식이 바뀌면 요청·응답 예시를 함께 수정합니다.
- 실제 사진, 위치정보, API 키가 커밋되지 않았는지 확인합니다.

## 개인정보와 보안

여행사진은 얼굴뿐 아니라 촬영시간과 GPS를 포함할 수 있으므로 민감정보로 취급합니다.

- 실제 사용자 사진과 위치기록을 GitHub에 올리지 않습니다.
- `.env`, `uploads/`, `outputs/`는 Git에서 제외합니다.
- 업로드 파일은 처리 후 삭제할 수 있도록 설계합니다.
- 파일명·확장자·MIME 타입·크기·개수를 검증합니다.
- GPS 원문과 EXIF 전체를 로그에 남기지 않습니다.
- AI API에는 결과 생성에 필요한 최소 데이터만 전달합니다.
- AI API 키는 브라우저에 넣지 않고 서버에서만 사용합니다.
- Mapbox 공개 토큰도 허용 URL과 권한 범위를 제한합니다.

## 현재 단계 요약

현재 프로젝트는 여행 기록 서비스의 화면 흐름을 확인하는 초기 데모입니다. 다음 개발의 핵심은 화면을 더 꾸미는 것이 아니라 아래 연결을 실제 데이터로 완성하는 것입니다.

```text
실제 이동 경로 + 실제 여행 사진
→ 정리와 선별
→ 대표 장면
→ 시간순 여행 다이어리
```
