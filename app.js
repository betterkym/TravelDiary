const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const API_BASE_URL = window.API_BASE_URL || '';
const PHOTO_SPOT_RADIUS_M = 100;
const PHOTO_SPOT_MIN_DURATION_MS = 10 * 60 * 1000;
const PHOTO_SPOT_MIN_COUNT = 3;
const PHOTO_SPOT_GAP_MS = 5 * 60 * 1000;
const PHOTO_SPOT_MAX_SAME_PLACE_GAP_MS = 30 * 60 * 1000;
const FOOTPRINT_MIN_DISTANCE_M = 12;
const FOOTPRINT_MIN_GAP_MS = 15 * 1000;
const FOOTPRINT_MIN_REPEAT_DISTANCE_M = 1;
const CREATE_FORM_STORAGE_KEY = 'travel-diary:create-form';
const LAST_TRIP_ID_STORAGE_KEY = 'travel-diary:last-trip-id';
const LAST_DIARY_STORAGE_KEY = 'travel-diary:last-diary';

const state = {
  screen: 'create',
  previousScreen: null,
  mapState: 'before',
  diaryUnlocked: false,
  tripId: null,
  acceptedPhotoIds: new Set(),
  rejectedPhotoIds: new Set(),
  recordingStartedAt: null,
  recordingTimer: null,
  watchId: null,
  recordingElapsed: 0,
  recordingBonusSeconds: 0,
  map: null,
  currentMarker: null,
  footprintMarkers: [],
  locationSamples: [],
  lastFootprintAt: 0,
  lastFootprintLngLat: null,
  generatedDiary: null,
  photoUrls: [],
  trip: {
    title: '',
    date: '2026-07-15',
    region: '',
  },
  sampleTimeline: [
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
  createDiaryButton: document.getElementById('open-diary-button'),
  createPhotoImportButton: document.getElementById('create-photo-import-button'),
  tripTitle: document.getElementById('trip-title'),
  tripDate: document.getElementById('trip-date'),
  tripRegion: document.getElementById('trip-region'),
  tripSummaryText: document.getElementById('trip-summary-text'),
  diarySummaryText: document.getElementById('diary-summary-text'),
  mapCanvas: document.getElementById('map'),
  recordingBadge: document.getElementById('recording-badge'),
  recordingTime: document.getElementById('recording-time'),
  photoImportPanel: document.getElementById('photo-import-panel'),
  photoImportButton: document.getElementById('photo-import-button'),
  photoImportProgress: document.getElementById('photo-import-progress'),
  photoInput: document.getElementById('photo-input'),
  startRecording: document.getElementById('start-recording'),
  endRecording: document.getElementById('end-recording'),
  deleteDiaryButton: document.getElementById('delete-diary-button'),
  completeDiaryButton: document.getElementById('complete-diary-button'),
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
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseExifDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const normalized = dateString.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
}

function readAscii(view, offset, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function readRational(view, offset, littleEndian) {
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den ? num / den : 0;
}

function readSignedRational(view, offset, littleEndian) {
  const num = view.getInt32(offset, littleEndian);
  const den = view.getInt32(offset + 4, littleEndian);
  return den ? num / den : 0;
}

function parseIfd(view, tiffStart, offset, littleEndian) {
  const entries = {};
  const entryCount = view.getUint16(offset, littleEndian);
  for (let i = 0; i < entryCount; i += 1) {
    const entryOffset = offset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    const format = view.getUint16(entryOffset + 2, littleEndian);
    const components = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;
    const bytesPerFormat = [0, 1, 1, 2, 4, 8, 1, 1, 4, 8];
    const valueBytes = components * (bytesPerFormat[format] || 0);
    const dataOffset = valueBytes > 4 ? tiffStart + view.getUint32(valueOffset, littleEndian) : valueOffset;

    let value = null;
    switch (format) {
      case 1: // BYTE
      case 7: // UNDEFINED
        if (components === 1) {
          value = view.getUint8(dataOffset);
        } else {
          value = Array.from({ length: components }, (_, idx) => view.getUint8(dataOffset + idx));
        }
        break;
      case 2: // ASCII
        value = readAscii(view, dataOffset, components);
        break;
      case 3: // SHORT
        value = components === 1
          ? view.getUint16(dataOffset, littleEndian)
          : Array.from({ length: components }, (_, idx) => view.getUint16(dataOffset + idx * 2, littleEndian));
        break;
      case 4: // LONG
        value = components === 1
          ? view.getUint32(dataOffset, littleEndian)
          : Array.from({ length: components }, (_, idx) => view.getUint32(dataOffset + idx * 4, littleEndian));
        break;
      case 5: // RATIONAL
        value = Array.from({ length: components }, (_, idx) => readRational(view, dataOffset + idx * 8, littleEndian));
        break;
      case 10: // SRATIONAL
        value = Array.from({ length: components }, (_, idx) => readSignedRational(view, dataOffset + idx * 8, littleEndian));
        break;
      default:
        value = null;
    }

    entries[tag] = value;
  }
  return entries;
}

function parseExifBuffer(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return {};

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2, false);
    if (marker === 0xe1) {
      const header = readAscii(view, offset + 4, 4);
      if (header !== 'Exif') break;
      const tiffStart = offset + 10;
      const byteOrder = readAscii(view, tiffStart, 2);
      const littleEndian = byteOrder === 'II';
      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0 = parseIfd(view, tiffStart, tiffStart + firstIfdOffset, littleEndian);
      const exifOffset = ifd0[0x8769];
      const gpsOffset = ifd0[0x8825];
      const exifIfd = exifOffset ? parseIfd(view, tiffStart, tiffStart + exifOffset, littleEndian) : {};
      const gpsIfd = gpsOffset ? parseIfd(view, tiffStart, tiffStart + gpsOffset, littleEndian) : {};

      const dateString = exifIfd[0x9003] || ifd0[0x0132] || null;
      const takenAt = parseExifDate(dateString);
      const lat = parseGpsCoordinate(gpsIfd[1], gpsIfd[2], gpsIfd[3]);
      const lng = parseGpsCoordinate(gpsIfd[3], gpsIfd[4], gpsIfd[5]);

      return { takenAt, lat, lng };
    }
    offset += 2 + size;
  }

  return {};
}

function parseGpsCoordinate(ref, values, lonRef) {
  const dir = typeof ref === 'string' ? ref : typeof lonRef === 'string' ? lonRef : null;
  const nums = Array.isArray(values) ? values : null;
  if (!dir || !nums || nums.length < 3) return null;
  const [deg, min, sec] = nums;
  let result = deg + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') result *= -1;
  return result;
}

function parsePhotoFile(file) {
  return file.arrayBuffer().then((buffer) => {
    const exif = parseExifBuffer(buffer);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `photo_${Math.random().toString(16).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      takenAt: exif.takenAt || new Date(file.lastModified || Date.now()),
      lat: exif.lat ?? null,
      lng: exif.lng ?? null,
    };
  });
}

function findNearestLocationSample(targetTime) {
  if (!state.locationSamples.length || !targetTime) return null;
  let best = null;
  let bestGap = Infinity;
  for (const sample of state.locationSamples) {
    const gap = Math.abs(sample.timestamp - targetTime.getTime());
    if (gap < bestGap) {
      bestGap = gap;
      best = sample;
    }
  }
  return best;
}

function centerMapOn(lngLat, zoom = 15.5) {
  if (!state.map) return;
  state.map.easeTo({
    center: lngLat,
    zoom,
    duration: 700,
  });
}

function updateTripTexts() {
  const { title, date, region } = state.trip;
  const summary = `${title} · ${formatDateLabel(date)} · ${region}`;
  elements.tripSummaryText.textContent = summary;
  elements.diarySummaryText.textContent = summary;
  document.title = `${title} · Travel Diary`;
}

function buildApiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function updateNavButtons() {
  elements.navButtons.forEach((button) => {
    const target = button.dataset.nav;
    button.classList.toggle('is-active', state.screen === target);
    if (target === 'diary') {
      const locked = !state.diaryUnlocked;
      button.disabled = locked;
      button.title = locked ? '사진을 불러와 다이어리를 생성한 뒤 열 수 있어요.' : '다이어리 보기';
      button.setAttribute('aria-disabled', String(locked));
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  });
}

function initMapIfNeeded() {
  if (state.map || !window.mapboxgl || !MAPBOX_ACCESS_TOKEN) return;
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
  if (state.screen !== screen) {
    state.previousScreen = state.screen;
  }
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
  elements.photoImportPanel.hidden = mapState !== 'after';
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

function setUploadProgress(text, visible = true) {
  if (!elements.photoImportProgress) return;
  elements.photoImportProgress.textContent = text;
  elements.photoImportProgress.hidden = !visible;
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
  state.footprintMarkers.forEach((marker) => marker.remove());
  state.footprintMarkers = [];
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
  state.footprintMarkers.push(marker);
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

function handlePosition(position) {
  const lngLat = [position.coords.longitude, position.coords.latitude];
  const timestamp = position.timestamp || Date.now();
  state.locationSamples.push({
    lng: lngLat[0],
    lat: lngLat[1],
    timestamp,
  });

  ensureCurrentMarker(lngLat);
  centerMapOn(lngLat);
  updateRecordingTimer();

  const distanceFromLastFootprint = state.lastFootprintLngLat
    ? distanceMeters(state.lastFootprintLngLat, lngLat)
    : Infinity;
  const timeSinceLastFootprint = timestamp - state.lastFootprintAt;
  const shouldDropFootprint =
    !state.lastFootprintLngLat ||
    (timeSinceLastFootprint >= FOOTPRINT_MIN_GAP_MS &&
      distanceFromLastFootprint > FOOTPRINT_MIN_REPEAT_DISTANCE_M);

  if (shouldDropFootprint) {
    addFootprint(lngLat);
    state.lastFootprintLngLat = lngLat;
    state.lastFootprintAt = timestamp;
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
      : '현재 위치를 불러오지 못했어요. 위치 서비스 상태를 확인해 주세요.';
  showToast(message);
}

function startRecording() {
  if (!navigator.geolocation) {
    showToast('이 브라우저는 위치 기록을 지원하지 않아요.');
    return;
  }
  if (!window.mapboxgl || !MAPBOX_ACCESS_TOKEN) {
    showToast('지도를 불러올 토큰이 아직 설정되지 않았어요.');
    return;
  }

  if (!state.map) {
    initMapIfNeeded();
  }
  if (!state.map) {
    showToast('지도를 아직 불러오지 못했어요.');
    return;
  }

  clearLiveMarkers();
  state.locationSamples = [];
  state.generatedDiary = null;
  state.diaryUnlocked = false;
  updateNavButtons();

  stopTracking();
  state.recordingStartedAt = Date.now();
  state.recordingBonusSeconds = 0;
  state.recordingElapsed = 0;
  updateRecordingTimer();
  setMapState('recording');

  state.watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 15000,
  });

  state.recordingTimer = window.setInterval(updateRecordingTimer, 1000);
}

function endRecording() {
  stopTracking();
  updateRecordingTimer();
  setMapState('after');
  showToast('여행 사진 불러오기 버튼을 눌러 사진첩에서 사진을 선택해 주세요');
}

function getLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildClusters(photos, allowCrossDate = false) {
  const groups = [];
  for (const photo of photos) {
    const lastGroup = groups[groups.length - 1];
    const photoPoint = [photo.lng, photo.lat];
    const photoTime = photo.takenAt.getTime();
    const photoDateKey = getLocalDateKey(photo.takenAt);
    if (
      lastGroup &&
      (allowCrossDate || lastGroup.dateKey === photoDateKey)
    ) {
      const gap = photoTime - lastGroup.lastTakenAt;
      const distanceToAnchor = distanceMeters(lastGroup.anchorCenter, photoPoint);
      if (
        gap <= PHOTO_SPOT_GAP_MS &&
        distanceToAnchor <= PHOTO_SPOT_RADIUS_M
      ) {
        lastGroup.photos.push(photo);
        lastGroup.lastTakenAt = photoTime;
        continue;
      }
    }
    groups.push({
      photos: [photo],
      center: photoPoint,
      anchorCenter: photoPoint,
      firstTakenAt: photoTime,
      lastTakenAt: photoTime,
      dateKey: photoDateKey,
    });
  }
  return groups;
}

async function resolvePlaceName(lng, lat, fallbackLabel) {
  if (!MAPBOX_ACCESS_TOKEN) return fallbackLabel;
  try {
    const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
    endpoint.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    endpoint.searchParams.set('language', 'ko');
    endpoint.searchParams.set('types', 'place,address,poi');
    endpoint.searchParams.set('limit', '1');
    const response = await fetch(endpoint.toString());
    if (!response.ok) return fallbackLabel;
    const data = await response.json();
    const feature = data.features && data.features[0];
    return feature?.place_name || fallbackLabel;
  } catch {
    return fallbackLabel;
  }
}

function formatTimeLabel(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRoundedTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const rounded = new Date(date.getTime());
  const minutes = rounded.getMinutes();
  rounded.setMinutes(minutes < 15 ? 0 : minutes < 45 ? 30 : 0);
  if (minutes >= 45) {
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setSeconds(0, 0);
  const hour = rounded.getHours();
  const minute = rounded.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const minuteText = minute === 0 ? '정각' : '30분';
  return `${period} ${displayHour}시 ${minuteText}`;
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function formatDateTimeLabel(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function saveLastTripId(tripId) {
  if (!window.localStorage || !tripId) return;
  window.localStorage.setItem(LAST_TRIP_ID_STORAGE_KEY, tripId);
}

function loadLastTripId() {
  if (!window.localStorage) return null;
  return window.localStorage.getItem(LAST_TRIP_ID_STORAGE_KEY);
}

function clearLastTripId() {
  if (!window.localStorage) return;
  window.localStorage.removeItem(LAST_TRIP_ID_STORAGE_KEY);
}

function saveLastDiarySnapshot(payload) {
  if (!window.localStorage || !payload) return;
  window.localStorage.setItem(LAST_DIARY_STORAGE_KEY, JSON.stringify(payload));
}

function loadLastDiarySnapshot() {
  if (!window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LAST_DIARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearLastDiarySnapshot() {
  if (!window.localStorage) return;
  window.localStorage.removeItem(LAST_DIARY_STORAGE_KEY);
}

function diaryFromApi(diary) {
  if (!diary) return null;
  const timeline = Array.isArray(diary.timeline) ? diary.timeline : [];
  return timeline.map((entry, index) => {
    const entryDate = new Date(entry.time);
    return {
      photoId: diary.selected_photos?.[index]?.photo_id || entry.photo_url || index,
      photoIds: diary.selected_photos?.slice(index, index + 3).map((photo) => photo.photo_id) || [],
      time: formatRoundedTimeLabel(entryDate),
      dateLabel: `${formatMonthDay(entryDate)} · ${diary.title || state.trip.title || '여행'}`,
      dayLabel: `${index + 1}일차`,
      place: entry.place,
      note: entry.note,
      photoCount: diary.selected_photos?.length || 0,
      photoUrls: entry.photo_url ? [entry.photo_url] : [],
      center: entry.lat && entry.lng ? [entry.lng, entry.lat] : null,
      timestamp: entryDate,
      durationMinutes: null,
    };
  });
}

async function restoreLastTrip() {
  const snapshot = loadLastDiarySnapshot();
  if (snapshot?.entries?.length) {
    state.tripId = snapshot.tripId || state.tripId;
    state.generatedDiary = snapshot.entries;
    state.diaryUnlocked = true;
    state.photoUrls = Array.isArray(snapshot.photoUrls) ? snapshot.photoUrls : [];
    state.trip = {
      title: snapshot.title || state.trip.title,
      date: snapshot.date || state.trip.date,
      region: snapshot.region || state.trip.region,
    };
    updateTripTexts();
    updateNavButtons();
    renderTimeline(snapshot.entries);
    setScreen('diary');
    return true;
  }

  let tripId = loadLastTripId();
  if (!tripId) {
    try {
      const latestResponse = await fetch(buildApiUrl('/api/trips/latest'));
      if (latestResponse.ok) {
        const latest = await latestResponse.json();
        tripId = latest.trip_id || null;
        if (tripId) saveLastTripId(tripId);
      }
    } catch (error) {
      console.warn('failed to load latest trip id', error);
    }
  }
  if (!tripId) return false;

  try {
    const [diaryResponse, photosResponse] = await Promise.all([
      fetch(buildApiUrl(`/api/trips/${tripId}/diary`)),
      fetch(buildApiUrl(`/api/trips/${tripId}/photos`)),
    ]);
    if (!diaryResponse.ok) return false;

    const diary = await diaryResponse.json();
    const restoredEntries = diaryFromApi(diary);
    if (!restoredEntries?.length) return false;

    let restoredPhotoCount = 0;
    if (photosResponse.ok) {
      const photosPayload = await photosResponse.json();
      const restoredPhotos = Array.isArray(photosPayload?.photos) ? photosPayload.photos : [];
      restoredPhotoCount = restoredPhotos.length;
      state.photoUrls = restoredPhotos
        .map((photo) => photo?.filename ? buildApiUrl(`/uploads/${photo.filename}`) : null)
        .filter(Boolean);
    }

    state.tripId = tripId;
    state.generatedDiary = restoredEntries;
    state.diaryUnlocked = true;
    state.trip = {
      title: diary.title || state.trip.title,
      date: state.trip.date,
      region: state.trip.region,
    };
    updateTripTexts();
    updateNavButtons();
    renderTimeline(restoredEntries);
    setScreen('diary');
    if (restoredPhotoCount > 0) {
      showToast(`사진 ${restoredPhotoCount}장을 다시 불러왔어요`);
    }
    return true;
  } catch (error) {
    console.warn('failed to restore last trip', error);
    return false;
  }
}

async function generateDiaryFromFiles(files) {
  const parsed = await Promise.all(files.map(parsePhotoFile));
  const photoData = parsed
    .map((photo) => {
      if ((!photo.lat || !photo.lng) && photo.takenAt) {
        const nearest = findNearestLocationSample(photo.takenAt);
        if (nearest) {
          photo.lat = nearest.lat;
          photo.lng = nearest.lng;
        }
      }
      return photo;
    })
    .filter((photo) => photo.takenAt && Number.isFinite(photo.lat) && Number.isFinite(photo.lng));

  if (!photoData.length) {
    showToast('촬영 시간과 위치 정보를 읽을 수 있는 사진이 필요해요.');
    return;
  }

  cleanupGeneratedPhotoUrls();
  state.photoUrls = photoData.map((photo) => photo.url);
  syncTripDateFromPhotos(photoData);

  await Promise.all(photoData.map(async (photo, index) => {
    const fallbackPlace = `기록 스팟 ${index + 1}`;
    photo.placeName = await resolvePlaceName(photo.lng, photo.lat, fallbackPlace);
  }));

  photoData.sort((a, b) => a.takenAt - b.takenAt);
  const dateKeys = [...new Set(photoData.map((photo) => getLocalDateKey(photo.takenAt)).filter(Boolean))];
  const allowCrossDate = dateKeys.length > 1
    ? window.confirm('사진 날짜가 달라요. 같은 여행으로 이어서 묶을까요?')
    : false;
  const clusters = buildClusters(photoData, allowCrossDate);
  const clusterSummary = clusters
    .map((cluster, index) => {
      const firstPhoto = cluster.photos[0];
      const lastPhoto = cluster.photos[cluster.photos.length - 1];
      return `#${index + 1} ${cluster.photos.length}장 | ${firstPhoto.placeName || 'unknown'} | ${formatDateTimeLabel(firstPhoto.takenAt)} ~ ${formatDateTimeLabel(lastPhoto.takenAt)}`;
    })
    .join('\n');
  console.debug('[TravelDiary] clusters', {
    photoCount: photoData.length,
    clusterCount: clusters.length,
    allowCrossDate,
    summary: clusterSummary,
  });
  showToast(`클러스터 ${clusters.length}개가 만들어졌어요`);
  const targetClusters = clusters;
  const entries = [];
  const tripName = state.trip.title || '여행';
  const dayIndexByDate = new Map();
  let nextDayIndex = 1;

  for (let i = 0; i < targetClusters.length; i += 1) {
    const cluster = targetClusters[i];
    const firstPhoto = cluster.photos[0];
    const dateKey = getLocalDateKey(firstPhoto.takenAt);
    if (!dayIndexByDate.has(dateKey)) {
      dayIndexByDate.set(dateKey, nextDayIndex);
      nextDayIndex += 1;
    }
    const dayIndex = dayIndexByDate.get(dateKey);
    const durationMinutes = Math.max(1, Math.round((cluster.lastTakenAt - cluster.firstTakenAt) / 60000));
    const timeLabel = formatRoundedTimeLabel(firstPhoto.takenAt);
    const place = firstPhoto.placeName || `기록 스팟 ${i + 1}`;
    const photoCount = cluster.photos.length;
    const photoUrls = cluster.photos.slice(0, 3).map((photo) => photo.url);
    const selectedPhotos = cluster.photos.slice(0, 3);
    entries.push({
      photoId: selectedPhotos[0].id,
      photoIds: selectedPhotos.map((photo) => photo.id),
      time: timeLabel,
      dateLabel: `${formatMonthDay(firstPhoto.takenAt)} · ${tripName}`,
      dayLabel: `${dayIndex}일차`,
      place,
      note: `반경 ${PHOTO_SPOT_RADIUS_M}m 안에서 ${durationMinutes}분 동안 머무르며 사진 ${photoCount}장을 기록했어요.`,
      photoCount,
      photoUrls,
      center: cluster.center,
      timestamp: firstPhoto.takenAt,
      durationMinutes,
    });
  }

  state.generatedDiary = entries;
  state.diaryUnlocked = true;
  saveLastDiarySnapshot({
    tripId: state.tripId,
    title: state.trip.title,
    date: state.trip.date,
    region: state.trip.region,
    entries: state.generatedDiary,
    photoUrls: state.photoUrls,
  });
  updateNavButtons();
  renderTimeline(entries);
  setScreen('diary');
  showToast('오늘의 여정이 다이어리로 정리되었습니다');
}

function renderTimeline(entries = state.generatedDiary || state.sampleTimeline) {
  elements.timeline.innerHTML = entries
    .map((entry, index) => {
      const photoUrls = Array.isArray(entry.photoUrls) ? entry.photoUrls.slice(0, 3) : [];
      const gallery = photoUrls.length
        ? `
          <div class="timeline-gallery timeline-gallery--${photoUrls.length}">
            ${photoUrls.map((url, photoIndex) => `
              <div class="timeline-photo-wrap">
                <img class="timeline-thumb" src="${url}" alt="${entry.place} 사진 ${photoIndex + 1}" />
                <button class="photo-feedback-button photo-feedback-button--approve" type="button" data-feedback-photo="${entry.photoIds?.[photoIndex] || entry.photoId || index}" data-feedback-kind="approve" aria-label="이 사진 좋아요">👍</button>
                <button class="photo-feedback-button photo-feedback-button--reject" type="button" data-feedback-photo="${entry.photoIds?.[photoIndex] || entry.photoId || index}" data-feedback-kind="reject" aria-label="이 사진 별로예요">👎</button>
              </div>
            `).join('')}
          </div>
        `
        : '';
      return `
        <article class="timeline-entry">
          <div class="timeline-rail">
            <div class="timeline-dot"></div>
          </div>
          <div class="timeline-card">
            <div class="timeline-section">
              <p class="timeline-section-label">${entry.dateLabel || ''}</p>
              <p class="timeline-section-time">${entry.dayLabel ? `${entry.dayLabel} · ${entry.time}` : entry.time}</p>
            </div>
            <div class="timeline-meta">
              <button class="timeline-button" type="button" data-view-map="${index}">지도에서 보기</button>
            </div>
            <h3 class="timeline-place">${entry.place}</h3>
            <div class="timeline-photo-row">
              <p class="timeline-count">${entry.photoCount ? `사진 ${entry.photoCount}장` : ''}</p>
              <p class="timeline-count">${entry.durationMinutes ? `${entry.durationMinutes}분 기록` : ''}</p>
            </div>
            ${photoUrls.length >= 3 ? '<p class="timeline-note timeline-note--hint">대표 사진 3장을 골라 보여드려요.</p>' : ''}
            ${gallery}
            <p class="timeline-note">${entry.note}</p>
          </div>
        </article>
      `;
    })
    .join('');

  elements.timeline.querySelectorAll('[data-view-map]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.viewMap);
      const entry = entries[index];
      setScreen('map');
      if (entry?.center && state.map) {
        centerMapOn(entry.center, 16.5);
      }
    });
  });

}

function syncCreateFields() {
  const stored = loadCreateFormState();
  elements.tripTitle.value = '';
  elements.tripDate.value = stored.date || state.trip.date;
  elements.tripRegion.value = '';
}

function saveCreateFormState() {
  if (!window.localStorage) return;
  const payload = {
    date: elements.tripDate?.value || '',
    region: elements.tripRegion?.value || '',
  };
  window.localStorage.setItem(CREATE_FORM_STORAGE_KEY, JSON.stringify(payload));
}

function loadCreateFormState() {
  if (!window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CREATE_FORM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function syncTripDateFromPhotos(photoData) {
  const photoDates = photoData
    .map((photo) => photo.takenAt)
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));
  if (!photoDates.length) return false;

  const earliest = new Date(Math.min(...photoDates.map((date) => date.getTime())));
  const photoDate = formatLocalDate(earliest);
  if (!photoDate || photoDate === state.trip.date) return false;

  state.trip.date = photoDate;
  elements.tripDate.value = photoDate;
  saveCreateFormState();
  updateTripTexts();
  return true;
}

function createTrip() {
  const nextTitle = elements.tripTitle.value.trim();
  const nextRegion = elements.tripRegion.value.trim();
  cleanupGeneratedPhotoUrls();
  stopTracking();
  const nextTrip = {
    title: nextTitle || '새 여행',
    date: elements.tripDate.value,
    region: nextRegion || '미정 지역',
  };

  const resetLocalState = () => {
    state.trip = nextTrip;
    state.generatedDiary = null;
    state.diaryUnlocked = false;
    state.locationSamples = [];
    state.recordingStartedAt = null;
    state.recordingElapsed = 0;
    state.recordingBonusSeconds = 0;
    state.tripId = null;
    state.acceptedPhotoIds = new Set();
    state.rejectedPhotoIds = new Set();
    clearLiveMarkers();
    updateTripTexts();
    renderTimeline();
    setScreen('map');
    setMapState('before');
  };

  resetLocalState();

  fetch(buildApiUrl('/api/trips'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: nextTrip.title,
      start_date: nextTrip.date,
      region: nextTrip.region,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to create trip: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      state.tripId = data.trip_id || null;
      if (state.tripId) {
        saveLastTripId(state.tripId);
        showToast('여행이 서버에 생성되었어요. 이제 사진을 올릴 수 있어요.');
      }
    })
    .catch((error) => {
      console.error(error);
      showToast('여행 생성 API 연결은 실패했지만, 로컬 화면은 사용할 수 있어요.');
    });
}

function handleNav(target) {
  if (target === 'back') {
    if (state.diaryUnlocked) {
      setScreen('diary');
      return;
    }
    setScreen(state.previousScreen || 'create');
    return;
  }
  setScreen(target);
  if (target === 'map') {
    setMapState(state.mapState);
  }
}

function cleanupGeneratedPhotoUrls() {
  state.photoUrls.forEach((url) => URL.revokeObjectURL(url));
  state.photoUrls = [];
}

async function uploadPhotosToApi(files) {
  if (!state.tripId) return;

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildApiUrl(`/api/trips/${state.tripId}/photos`));

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      setUploadProgress(`업로드 중 ${percent}%`, true);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress('업로드 완료', true);
        window.setTimeout(() => setUploadProgress('', false), 1200);
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          reject(error);
        }
        return;
      }
      reject(new Error(`Photo upload failed: ${xhr.status}`));
    });

    xhr.addEventListener('error', () => reject(new Error('Photo upload failed: network error')));
    xhr.addEventListener('abort', () => reject(new Error('Photo upload aborted')));
    setUploadProgress('업로드 시작...', true);
    xhr.send(formData);
  });
}

async function submitPhotoFeedback(photoId, kind = 'reject') {
  if (!state.tripId || !photoId) return;
  if (kind === 'approve') {
    state.acceptedPhotoIds.add(photoId);
    state.rejectedPhotoIds.delete(photoId);
  } else {
    state.rejectedPhotoIds.add(photoId);
    state.acceptedPhotoIds.delete(photoId);
  }
  const rejected_photo_ids = Array.from(state.rejectedPhotoIds);
  const accepted_photo_ids = Array.from(state.acceptedPhotoIds);

  const response = await fetch(buildApiUrl(`/api/trips/${state.tripId}/photo-feedback`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accepted_photo_ids,
      rejected_photo_ids,
      notes: 'user disliked photo',
    }),
  });
  if (!response.ok) {
    throw new Error(`Photo feedback failed: ${response.status}`);
  }
  return response.json();
}

function bootstrap() {
  syncCreateFields();
  updateTripTexts();
  renderTimeline();
  setScreen('create');
  setMapState('before');
  updateRecordingTimer();

  elements.createForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createTrip();
  });
  elements.createTripButton.addEventListener('click', createTrip);
  elements.createDiaryButton?.addEventListener('click', () => handleNav('diary'));
  elements.createPhotoImportButton?.addEventListener('click', () => {
    elements.photoInput.value = '';
    elements.photoInput.click();
  });
  elements.tripTitle.addEventListener('input', saveCreateFormState);
  elements.tripDate.addEventListener('input', saveCreateFormState);
  elements.tripRegion.addEventListener('input', saveCreateFormState);
  elements.tripTitle.addEventListener('focus', () => {
    elements.tripTitle.removeAttribute('readonly');
  });
  elements.tripRegion.addEventListener('focus', () => {
    elements.tripRegion.removeAttribute('readonly');
  });
  elements.startRecording.addEventListener('click', startRecording);
  elements.endRecording.addEventListener('click', endRecording);
  elements.photoImportButton.addEventListener('click', () => {
    elements.photoInput.value = '';
    elements.photoInput.click();
  });
  elements.photoInput.addEventListener('change', async () => {
    const files = Array.from(elements.photoInput.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    try {
      await uploadPhotosToApi(files);
      await generateDiaryFromFiles(files);
    } catch (error) {
      console.error(error);
      setUploadProgress('', false);
      showToast('사진 업로드 또는 처리 중 오류가 발생했어요.');
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('service worker registration failed', error);
    });
  }

  elements.timeline.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-feedback-photo]');
    if (!button) return;
    const photoId = button.dataset.feedbackPhoto;
    const kind = button.dataset.feedbackKind || 'reject';
    if (!photoId || photoId === 'undefined') return;
    try {
      await submitPhotoFeedback(photoId, kind);
      button.classList.add('is-sent');
      showToast(kind === 'approve' ? '좋아요를 반영했어요' : '별로예요를 반영했어요');
    } catch (error) {
      console.error(error);
      showToast('선호 저장 중 오류가 발생했어요.');
    }
  });
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => handleNav(button.dataset.nav));
  });
  if (elements.completeDiaryButton) {
    elements.completeDiaryButton.addEventListener('click', () => {
      setScreen('create');
      showToast('다이어리를 닫았어요');
    });
  }
  if (elements.deleteDiaryButton) {
    elements.deleteDiaryButton.addEventListener('click', () => {
      const confirmed = window.confirm('삭제하시겠습니까?');
      if (!confirmed) return;
      cleanupGeneratedPhotoUrls();
      state.generatedDiary = null;
      state.diaryUnlocked = false;
      state.tripId = null;
      clearLastTripId();
      clearLastDiarySnapshot();
      state.acceptedPhotoIds = new Set();
      state.rejectedPhotoIds = new Set();
      renderTimeline();
      updateNavButtons();
      setScreen('create');
      showToast('다이어리를 삭제했어요');
    });
  }

  restoreLastTrip().catch((error) => {
    console.error(error);
  });
}

window.addEventListener('beforeunload', cleanupGeneratedPhotoUrls);
bootstrap();
