const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';

const state = {
  screen: 'create',
  mapState: 'before',
  diaryUnlocked: false,
  recordingStartedAt: null,
  recordingTimer: null,
  recordingBonusSeconds: 0,
  recordingElapsed: 0,
  watchId: null,
  map: null,
  currentMarker: null,
  footprints: [],
  lastFootprintAt: 0,
  lastFootprintLngLat: null,
  trip: {
    title: '탈린의 겨울 산책',
    date: '2026-07-15',
    region: '에스토니아 탈린',
  },
  timeline: [
    {
      time: '오전 10시 30분',
      place: '탈린 항구',
      note: '바다 바람이 좋아서 천천히 걸으며 첫 사진을 남겼어요.',
      image: makePhotoData('탈린 항구', '#f2c8aa', '#d87b58'),
    },
    {
      time: '오전 11시 20분',
      place: '비루 게이트',
      note: '구시가지 입구에서 발자국 경로가 가장 선명하게 보였어요.',
      image: makePhotoData('비루 게이트', '#e9d2b7', '#bb7251'),
    },
    {
      time: '오후 12시 10분',
      place: '탈린 시청 광장',
      note: '광장 한복판의 따뜻한 점심 시간 분위기를 기록했어요.',
      image: makePhotoData('탈린 시청 광장', '#ecd8c8', '#cf8a63'),
    },
    {
      time: '오후 2시',
      place: '코투오차 전망대',
      note: '도시 전체가 내려다보이는 마지막 장면을 남겼어요.',
      image: makePhotoData('코투오차 전망대', '#dcc5ad', '#a85f46'),
    },
  ],
};

const elements = {
  createScreen: document.querySelector('[data-screen="create"]'),
  mapScreen: document.querySelector('[data-screen="map"]'),
  diaryScreen: document.querySelector('[data-screen="diary"]'),
  createForm: document.getElementById('create-form'),
  createTripButton: document.getElementById('create-trip-button'),
  tripTitle: document.getElementById('trip-title'),
  tripDate: document.getElementById('trip-date'),
  tripRegion: document.getElementById('trip-region'),
  tripSummaryText: document.getElementById('trip-summary-text'),
  diarySummaryText: document.getElementById('diary-summary-text'),
  mapCanvas: document.getElementById('map'),
  recordingBadge: document.getElementById('recording-badge'),
  recordingTime: document.getElementById('recording-time'),
  startRecording: document.getElementById('start-recording'),
  endRecording: document.getElementById('end-recording'),
  navButtons: Array.from(document.querySelectorAll('[data-nav]')),
  timeline: document.getElementById('timeline'),
  toast: document.getElementById('toast'),
};

function makePhotoData(title, baseColor, accentColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${baseColor}" />
          <stop offset="100%" stop-color="${accentColor}" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="36" fill="url(#g)" />
      <circle cx="136" cy="88" r="46" fill="rgba(255,255,255,0.36)" />
      <path d="M0 270 C90 220, 160 220, 240 255 S400 320, 640 230 L640 360 L0 360 Z" fill="rgba(255,255,255,0.22)" />
      <path d="M120 255 L180 196 L240 238 L300 174 L375 225 L430 190 L520 250" fill="none" stroke="rgba(255,255,255,0.54)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
      <text x="48" y="86" fill="rgba(255,255,255,0.94)" font-family="Georgia, serif" font-size="42" font-weight="700">${title}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatDateLabel(dateValue) {
  if (!dateValue) return '날짜를 선택해 주세요';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatElapsed(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function makeFootprintElement() {
  const el = document.createElement('div');
  el.className = 'footprint-marker';
  el.innerHTML = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="21" cy="14" rx="5" ry="7" transform="rotate(-18 21 14)"></ellipse>
        <ellipse cx="33" cy="11" rx="5" ry="7" transform="rotate(5 33 11)"></ellipse>
        <ellipse cx="44" cy="16" rx="5" ry="7" transform="rotate(22 44 16)"></ellipse>
        <ellipse cx="50" cy="27" rx="4.6" ry="6.4" transform="rotate(34 50 27)"></ellipse>
        <path d="M18 22c-5 8-5 18 0 26 4 6 10 8 15 8s11-2 15-7c4-5 5-13 2-20-2-6-6-10-11-12-7-3-16-2-21 5z"></path>
      </g>
    </svg>
  `;
  return el;
}

function makeCurrentLocationElement() {
  const el = document.createElement('div');
  el.className = 'current-location-marker';
  el.innerHTML = '<span></span>';
  return el;
}

function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function updateTripTexts() {
  const { title, date, region } = state.trip;
  const dateLabel = formatDateLabel(date);
  const summary = `${title} · ${dateLabel} · ${region}`;
  elements.tripSummaryText.textContent = summary;
  elements.diarySummaryText.textContent = summary;
  document.title = `${title} · Travel Diary`;
}

function updateNavButtons() {
  elements.navButtons.forEach((button) => {
    const target = button.dataset.nav;
    button.classList.toggle('is-active', state.screen === target);
    if (target === 'diary') {
      const locked = !state.diaryUnlocked;
      button.disabled = locked;
      button.title = locked ? '기록 종료 후 열 수 있어요.' : '다이어리 보기';
      button.setAttribute('aria-disabled', String(locked));
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  });
}

function initMapIfNeeded() {
  if (state.map || !window.mapboxgl) return;
  if (!MAPBOX_ACCESS_TOKEN) return;
  window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  state.map = new window.mapboxgl.Map({
    container: elements.mapCanvas,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [0, 20],
    zoom: 2.5,
    attributionControl: false,
  });
}

function setScreen(screen) {
  state.screen = screen;
  elements.createScreen.hidden = screen !== 'create';
  elements.mapScreen.hidden = screen !== 'map';
  elements.diaryScreen.hidden = screen !== 'diary';

  if (screen === 'map') {
    initMapIfNeeded();
    window.requestAnimationFrame(() => {
      if (state.map) state.map.resize();
    });
  }

  updateNavButtons();
}

function setMapState(mapState) {
  state.mapState = mapState;
  elements.recordingBadge.hidden = mapState !== 'recording';
  elements.startRecording.hidden = mapState !== 'before';
  elements.endRecording.hidden = mapState !== 'recording';
}

function updateRecordingTimer() {
  if (!state.recordingStartedAt) return;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - state.recordingStartedAt) / 1000) + state.recordingBonusSeconds,
  );
  state.recordingElapsed = elapsed;
  elements.recordingTime.textContent = formatElapsed(elapsed);
}

function showToast(message) {
  elements.toast.querySelector('p').textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1800);
}

function stopTracking() {
  if (state.watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.watchId);
  }
  state.watchId = null;
  if (state.recordingTimer) {
    clearInterval(state.recordingTimer);
    state.recordingTimer = null;
  }
}

function clearLiveMarkers() {
  state.footprints.forEach((marker) => marker.remove());
  state.footprints = [];
  if (state.currentMarker) {
    state.currentMarker.remove();
    state.currentMarker = null;
  }
  state.lastFootprintLngLat = null;
  state.lastFootprintAt = 0;
}

function addFootprint(lngLat) {
  if (!state.map) return;
  const marker = new window.mapboxgl.Marker({
    element: makeFootprintElement(),
    anchor: 'center',
  })
    .setLngLat(lngLat)
    .addTo(state.map);
  state.footprints.push(marker);
}

function ensureCurrentMarker(lngLat) {
  if (!state.map) return;
  if (!state.currentMarker) {
    state.currentMarker = new window.mapboxgl.Marker({
      element: makeCurrentLocationElement(),
      anchor: 'center',
    }).setLngLat(lngLat).addTo(state.map);
    return;
  }
  state.currentMarker.setLngLat(lngLat);
}

function centerMapOn(lngLat, zoom = 15.5) {
  if (!state.map) return;
  state.map.easeTo({
    center: lngLat,
    zoom,
    duration: 700,
  });
}

function handlePosition(position) {
  const lngLat = [position.coords.longitude, position.coords.latitude];
  const now = position.timestamp || Date.now();
  state.recordingElapsed = Math.max(
    0,
    Math.floor((now - state.recordingStartedAt) / 1000) + state.recordingBonusSeconds,
  );
  updateRecordingTimer();
  ensureCurrentMarker(lngLat);
  centerMapOn(lngLat);

  const shouldDropFootprint =
    !state.lastFootprintLngLat ||
    distanceMeters(state.lastFootprintLngLat, lngLat) >= 12 ||
    now - state.lastFootprintAt >= 8000;

  if (shouldDropFootprint) {
    addFootprint(lngLat);
    state.lastFootprintLngLat = lngLat;
    state.lastFootprintAt = now;
  }
}

function handlePositionError(error) {
  stopTracking();
  state.recordingStartedAt = null;
  state.recordingElapsed = 0;
  state.recordingBonusSeconds = 0;
  setMapState('before');

  const message =
    error && error.code === 1
      ? '위치 권한이 필요합니다. 브라우저에서 위치 사용을 허용해 주세요.'
      : '현재 위치를 불러오지 못했어요. 위치 서비스가 켜져 있는지 확인해 주세요.';

  showToast(message);
}

function startRecording() {
  if (!navigator.geolocation) {
    showToast('이 브라우저는 위치 기록을 지원하지 않아요.');
    return;
  }

  if (!window.mapboxgl) {
    showToast('지도를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
    return;
  }

  if (!state.map) {
    initMapIfNeeded();
  }

  if (!state.map) {
    showToast('지도 토큰이 설정되지 않았어요.');
    return;
  }

  clearLiveMarkers();
  state.diaryUnlocked = false;
  state.recordingStartedAt = Date.now();
  state.recordingBonusSeconds = 0;
  state.recordingElapsed = 0;
  updateRecordingTimer();
  setMapState('recording');
  updateNavButtons();

  stopTracking();

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    handlePositionError,
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    },
  );

  state.recordingTimer = window.setInterval(updateRecordingTimer, 1000);
}

function endRecording() {
  stopTracking();
  state.diaryUnlocked = true;
  updateNavButtons();
  setMapState('after');
  updateRecordingTimer();
  showToast('오늘의 여정이 다이어리로 정리되었습니다');
  window.setTimeout(() => {
    setScreen('diary');
  }, 900);
}

function renderTimeline() {
  elements.timeline.innerHTML = state.timeline
    .map(
      (entry) => `
        <article class="timeline-entry">
          <div class="timeline-rail">
            <div class="timeline-dot"></div>
          </div>
          <div class="timeline-card">
            <div class="timeline-meta">
              <p class="timeline-time">${entry.time}</p>
              <button class="timeline-button" type="button" data-view-map>지도에서 보기</button>
            </div>
            <h3 class="timeline-place">${entry.place}</h3>
            <img class="timeline-photo" src="${entry.image}" alt="${entry.place} 사진" />
            <p class="timeline-note">${entry.note}</p>
          </div>
        </article>
      `,
    )
    .join('');

  elements.timeline.querySelectorAll('[data-view-map]').forEach((button) => {
    button.addEventListener('click', () => {
      setScreen('map');
      setMapState('after');
    });
  });
}

function syncCreateFields() {
  elements.tripTitle.value = state.trip.title;
  elements.tripDate.value = state.trip.date;
  elements.tripRegion.value = state.trip.region;
}

function createTrip() {
  const nextTitle = elements.tripTitle.value.trim();
  const nextRegion = elements.tripRegion.value.trim();
  state.trip = {
    title: nextTitle || '새 여행',
    date: elements.tripDate.value,
    region: nextRegion || '미정 지역',
  };
  updateTripTexts();
  setScreen('map');
  setMapState('before');
}

function handleNav(target) {
  if (target === 'diary' && !state.diaryUnlocked) return;
  setScreen(target);
}

function bootstrap() {
  syncCreateFields();
  updateTripTexts();
  renderTimeline();
  setScreen('create');
  setMapState('before');

  elements.createForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createTrip();
  });
  elements.createTripButton.addEventListener('click', createTrip);
  elements.startRecording.addEventListener('click', startRecording);
  elements.endRecording.addEventListener('click', endRecording);
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => handleNav(button.dataset.nav));
  });
}

bootstrap();
