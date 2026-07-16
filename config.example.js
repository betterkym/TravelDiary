// 로컬 프런트 설정 예시.
// 사용법: 이 파일을 config.local.js 로 복사한 뒤 실제 토큰을 넣으세요.
//   cp config.example.js config.local.js
// config.local.js 는 .gitignore 되어 커밋되지 않습니다. 실제 토큰은 절대 커밋하지 마세요.

// Mapbox 공개 토큰 (mapbox.com > Account > Access tokens 에서 발급, pk. 로 시작)
window.MAPBOX_ACCESS_TOKEN = "pk.여기에_공개_토큰";

// Google Analytics 4 측정 ID (예: G-XXXXXXXXXX)
window.GA4_MEASUREMENT_ID = "G-여기에_측정ID";

// Supabase 연결용 DB URL. Vercel 환경변수에도 같은 이름으로 넣으세요.
// 예: postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
window.SUPABASE_DB_URL = "";

// 백엔드 API 주소 (프런트↔백엔드 연결 시 1번이 사용). 예: 로컬 개발
window.API_BASE_URL = "http://localhost:8001";
