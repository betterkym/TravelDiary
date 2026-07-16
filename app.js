const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const STORAGE_KEY = 'travel-diary.trips.v1';
const TRIP_DB_NAME = 'travel-diary-db';
const TRIP_DB_VERSION = 1;
const TRIP_DB_STORE = 'state';
const TRIP_DB_KEY = 'trips';
const API_BASE_URL = window.API_BASE_URL || '';
const PHOTO_SPOT_RADIUS_M = 100;
const PHOTO_SPOT_GAP_MS = 2 * 60 * 1000;
const REPRESENTATIVE_PHOTOS_PER_SPOT = 3;
const SIMILAR_PHOTO_GAP_MS = 15 * 1000;
const SIMILAR_PHOTO_DISTANCE_M = 8;
const PHOTO_LOCATION_MAX_SAMPLE_DISTANCE_M = 30;
const PHOTO_LOCATION_MATCH_WINDOW_MS = 30 * 60 * 1000;
const FOOTPRINT_MIN_DISTANCE_M = 12;
const FOOTPRINT_MIN_GAP_MS = 15 * 1000;
const FOOTPRINT_MIN_REPEAT_DISTANCE_M = 1;
const LOCATION_SYNC_BATCH_SIZE = 5;
const LOCATION_SYNC_MIN_INTERVAL_MS = 15 * 1000;
const CREATE_FORM_STORAGE_KEY = 'travel-diary:create-form';
const LAST_TRIP_ID_STORAGE_KEY = 'travel-diary:last-trip-id';

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
  routeLine: null,
  pendingRouteCoordinates: null,
  routeRenderQueued: false,
  locationSamples: [],
  lastFootprintAt: 0,
  lastFootprintLngLat: null,
  pendingLocationPoints: [],
  lastLocationSyncAt: 0,
  locationSyncInFlight: false,
  generatedDiary: null,
  photoUrls: [],
  savedTrips: [],
  selectedTripId: null,
  activeTripId: null,
  activeTrip: null,
  calendarOpen: false,
  calendarMonth: null,
  calendarSelectedDateKey: null,
  trip: {
    title: '',
    date: '',
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
      note: '구시가지 골목 사이로 햇살이 깊게 들어와 오래 머물렀어요.',
      image: makePhotoData('비루 게이트', '#e9d2b7', '#bb7251'),
    },
    {
      time: '오후 12시 10분',
      place: '탈린 시청 광장',
      note: '광장 주변의 소란스러움과 여유로움이 함께 느껴진 순간이었어요.',
      image: makePhotoData('탈린 시청 광장', '#ecd8c8', '#cf8a63'),
    },
    {
      time: '오후 2시',
      place: '코투오차 전망대',
      note: '도시 전체가 한눈에 내려다보이는 마지막 풍경이 가장 인상적이었어요.',
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
  calendarToggle: document.getElementById('calendar-toggle'),
  diaryCalendarToggle: document.getElementById('diary-calendar-toggle'),
  tripHistory: document.getElementById('trip-history'),
  mapCanvas: document.getElementById('map'),
  recordingBadge: document.getElementById('recording-badge'),
  recordingTime: document.getElementById('recording-time'),
  photoImportPanel: document.getElementById('photo-import-panel'),
  photoImportButton: document.getElementById('photo-import-button'),
  photoImportProgress: document.getElementById('photo-import-progress'),
  photoInput: document.getElementById('photo-input'),
  createUploadButton: document.getElementById('create-upload-button'),
  livePhotoButton: document.getElementById('live-photo-button'),
  livePhotoInput: document.getElementById('live-photo-input'),
  startRecording: document.getElementById('start-recording'),
  endRecording: document.getElementById('end-recording'),
  deleteDiaryButton: document.getElementById('delete-diary-button'),
  completeDiaryButton: document.getElementById('complete-diary-button'),
  memoryVideoButton: document.getElementById('memory-video-button'),
  navButtons: Array.from(document.querySelectorAll('[data-nav]')),
  timeline: document.getElementById('timeline'),
  calendarModal: document.getElementById('calendar-modal'),
  calendarGrid: document.getElementById('calendar-grid'),
  calendarMonthLabel: document.getElementById('calendar-month-label'),
  calendarPrev: document.getElementById('calendar-prev'),
  calendarNext: document.getElementById('calendar-next'),
  calendarClose: document.getElementById('calendar-close'),
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
  if (!dateValue) return '날짜를 선택해 주세요.';
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
  el.innerHTML = '<span aria-hidden="true"></span>';
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

function normalizeDateKey(dateValue) {
  if (!dateValue) return '';
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(dateValue).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createLocalDate(year, monthIndex, day = 1) {
  return new Date(year, monthIndex, day);
}

function formatCalendarMonth(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function formatCalendarDay(date) {
  return String(date.getDate());
}

function dedupeTripsByDate(trips) {
  const seen = new Set();
  const deduped = [];
  trips.forEach((trip) => {
    const key = normalizeDateKey(trip.date);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(trip);
  });
  return deduped;
}

function getTripByDateKey(dateKey) {
  return state.savedTrips.find((trip) => normalizeDateKey(trip.date) === dateKey) || null;
}

function getCalendarSelectedDateKey() {
  return normalizeDateKey(
    state.calendarSelectedDateKey ||
      state.trip.date ||
      elements.tripDate?.value ||
      getSelectedTrip()?.date ||
      new Date(),
  );
}

function getCalendarAnchorDate() {
  const selectedKey = getCalendarSelectedDateKey();
  const parsed = new Date(`${selectedKey}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function selectCalendarDate(dateKey) {
  state.calendarSelectedDateKey = dateKey;
  elements.tripDate.value = dateKey;
  saveCreateFormState();

  const trip = getTripByDateKey(dateKey);
  if (trip) {
    pickTrip(trip.id);
    renderTripOnMap(trip);
    closeCalendar();
    return;
  }

  state.trip.date = dateKey;
  const selectedTrip = state.savedTrips.find((item) => item.id === state.selectedTripId) || null;
  const canRetagActiveTrip =
    selectedTrip &&
    selectedTrip.id === state.activeTripId &&
    ['draft', 'recording', 'recorded'].includes(selectedTrip.status || 'draft');

  if (canRetagActiveTrip) {
    selectedTrip.date = dateKey;
    if (state.activeTrip?.id === selectedTrip.id) {
      state.activeTrip.date = dateKey;
    }
    upsertSavedTrip(selectedTrip);
  } else {
    state.selectedTripId = null;
    state.activeTripId = null;
    state.activeTrip = null;
    state.generatedDiary = null;
    state.diaryUnlocked = false;
  }

  updateTripTexts();
  renderTripHistory();
  if (state.screen === 'map') {
    clearLiveMarkers();
    setMapState('before');
  }
  if (state.screen === 'diary') {
    renderTimeline(state.sampleTimeline);
  }
  updateNavButtons();
  renderCalendar();
  closeCalendar();
  showToast(`${formatDateLabel(dateKey)} 날짜로 선택했어요.`);
}

function getCalendarMonthDate() {
  if (state.calendarMonth instanceof Date && !Number.isNaN(state.calendarMonth.getTime())) {
    return new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  }
  const anchor = getCalendarAnchorDate();
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

function setCalendarMonth(date) {
  state.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendar();
}

function openCalendar() {
  const anchor = getCalendarAnchorDate();
  state.calendarMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  state.calendarOpen = true;
  if (elements.calendarModal) {
    elements.calendarModal.hidden = false;
  }
  renderCalendar();
}

function closeCalendar() {
  state.calendarOpen = false;
  if (elements.calendarModal) {
    elements.calendarModal.hidden = true;
  }
}

function moveCalendarMonth(delta) {
  const current = getCalendarMonthDate();
  setCalendarMonth(new Date(current.getFullYear(), current.getMonth() + delta, 1));
}

function renderCalendar() {
  if (!elements.calendarGrid || !elements.calendarMonthLabel) return;
  const monthDate = getCalendarMonthDate();
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const selectedDateKey = getCalendarSelectedDateKey();
  const tripMap = new Map(state.savedTrips.map((trip) => [normalizeDateKey(trip.date), trip]));

  elements.calendarMonthLabel.textContent = formatCalendarMonth(monthDate);
  elements.calendarGrid.innerHTML = '';

  for (let i = 0; i < startOffset; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day is-empty';
    elements.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayDate = createLocalDate(year, monthIndex, day);
    const dateKey = normalizeDateKey(dayDate);
    const trip = tripMap.get(dateKey);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    if (trip) button.classList.add('has-trip');
    if (dateKey === selectedDateKey) button.classList.add('is-selected');
    button.innerHTML = `
      <span class="calendar-day-number">${formatCalendarDay(dayDate)}</span>
      <span class="calendar-day-label">${trip ? trip.title : '선택 가능'}</span>
    `;
    button.addEventListener('click', () => {
      selectCalendarDate(dateKey);
    });
    if (!trip) {
      button.classList.add('is-muted');
    }
    elements.calendarGrid.appendChild(button);
  }
}

function normalizeSavedTrip(trip) {
  const acceptedPhotoIds = Array.isArray(trip.feedback?.acceptedPhotoIds)
    ? trip.feedback.acceptedPhotoIds
    : Array.isArray(trip.feedback?.accepted_photo_ids)
      ? trip.feedback.accepted_photo_ids
      : [];
  const rejectedPhotoIds = Array.isArray(trip.feedback?.rejectedPhotoIds)
    ? trip.feedback.rejectedPhotoIds
    : Array.isArray(trip.feedback?.rejected_photo_ids)
      ? trip.feedback.rejected_photo_ids
      : [];
  return {
    id: trip.id,
    title: trip.title || '새 여행',
    date: trip.date || '',
    region: trip.region || '미정 지역',
    createdAt: trip.createdAt || new Date().toISOString(),
    status: trip.status || 'draft',
    recording: {
      startedAt: trip.recording?.startedAt ?? null,
      endedAt: trip.recording?.endedAt ?? null,
      elapsed: trip.recording?.elapsed ?? 0,
      samples: Array.isArray(trip.recording?.samples) ? trip.recording.samples : [],
      footprints: Array.isArray(trip.recording?.footprints) ? trip.recording.footprints : [],
      livePhotos: Array.isArray(trip.recording?.livePhotos) ? trip.recording.livePhotos : [],
    },
    diary: Array.isArray(trip.diary) ? trip.diary : [],
    photos: Array.isArray(trip.photos) ? trip.photos : [],
    feedback: {
      acceptedPhotoIds: acceptedPhotoIds.map(String),
      rejectedPhotoIds: rejectedPhotoIds.map(String),
    },
  };
}

function readSavedTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSavedTrip);
  } catch {
    return [];
  }
}

function stripLocalOnlyImage(value) {
  return typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:')) ? null : value;
}

function createLightweightTripRecord(trip) {
  const record = createTripRecord(trip);
  return {
    ...record,
    recording: {
      ...record.recording,
      livePhotos: Array.isArray(record.recording.livePhotos)
        ? record.recording.livePhotos.map((photo) => ({
            ...photo,
            dataUrl: stripLocalOnlyImage(photo.dataUrl),
          }))
        : [],
    },
    diary: record.diary.map((entry) => ({
      ...entry,
      image: stripLocalOnlyImage(entry.image),
      mainPhoto: stripLocalOnlyImage(entry.mainPhoto),
      photoUrls: Array.isArray(entry.photoUrls) ? entry.photoUrls.map(stripLocalOnlyImage).filter(Boolean) : [],
    })),
    photos: record.photos.map((photo) => ({
      ...photo,
      dataUrl: stripLocalOnlyImage(photo.dataUrl),
      url: stripLocalOnlyImage(photo.url),
    })),
  };
}

function openTripDatabase() {
  if (!window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(TRIP_DB_NAME, TRIP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRIP_DB_STORE)) {
        db.createObjectStore(TRIP_DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeSavedTripsToIndexedDb(trips) {
  try {
    const db = await openTripDatabase();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(TRIP_DB_STORE, 'readwrite');
      tx.objectStore(TRIP_DB_STORE).put({ id: TRIP_DB_KEY, trips });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('IndexedDB 저장 실패:', error);
  }
}

async function readSavedTripsFromIndexedDb() {
  try {
    const db = await openTripDatabase();
    if (!db) return [];
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(TRIP_DB_STORE, 'readonly');
      const request = tx.objectStore(TRIP_DB_STORE).get(TRIP_DB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return Array.isArray(result?.trips) ? result.trips.map(normalizeSavedTrip) : [];
  } catch (error) {
    console.warn('IndexedDB 복원 실패:', error);
    return [];
  }
}

function writeSavedTrips() {
  writeSavedTripsToIndexedDb(state.savedTrips);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedTrips.map(createLightweightTripRecord)));
  } catch {
    // Ignore storage quota errors in the MVP. IndexedDB still keeps the full copy.
  }
}

function createTripRecord(trip) {
  return {
    id: trip.id,
    title: trip.title,
    date: trip.date,
    region: trip.region,
    createdAt: trip.createdAt,
    recording: {
      startedAt: trip.recording?.startedAt ?? null,
      endedAt: trip.recording?.endedAt ?? null,
      elapsed: trip.recording?.elapsed ?? 0,
      samples: trip.recording?.samples ?? [],
      footprints: trip.recording?.footprints ?? [],
      livePhotos: trip.recording?.livePhotos ?? [],
    },
    diary: trip.diary ?? [],
    photos: trip.photos ?? [],
    feedback: {
      acceptedPhotoIds: Array.isArray(trip.feedback?.acceptedPhotoIds)
        ? trip.feedback.acceptedPhotoIds.map(String)
        : [],
      rejectedPhotoIds: Array.isArray(trip.feedback?.rejectedPhotoIds)
        ? trip.feedback.rejectedPhotoIds.map(String)
        : [],
    },
    status: trip.status ?? 'draft',
  };
}

function hasRouteRecording(recording) {
  return Boolean(
    recording &&
      (
        (Array.isArray(recording.samples) && recording.samples.length) ||
        (Array.isArray(recording.footprints) && recording.footprints.length)
      ),
  );
}

function mergeTripRecord(existing, incoming) {
  if (!existing) return incoming;
  const shouldKeepExistingRoute = incoming.status === 'completed' &&
    !hasRouteRecording(incoming.recording) &&
    hasRouteRecording(existing.recording);
  const shouldKeepExistingFeedback =
    !(incoming.feedback?.acceptedPhotoIds?.length || incoming.feedback?.rejectedPhotoIds?.length) &&
    (existing.feedback?.acceptedPhotoIds?.length || existing.feedback?.rejectedPhotoIds?.length);

  return {
    ...existing,
    ...incoming,
    recording: shouldKeepExistingRoute ? existing.recording : incoming.recording,
    feedback: shouldKeepExistingFeedback ? existing.feedback : incoming.feedback,
  };
}

function upsertSavedTrip(trip) {
  const record = createTripRecord(trip);
  const dateKey = normalizeDateKey(record.date);
  const index = state.savedTrips.findIndex(
    (item) => item.id === record.id || normalizeDateKey(item.date) === dateKey,
  );
  if (index >= 0) {
    state.savedTrips[index] = mergeTripRecord(state.savedTrips[index], record);
  } else {
    state.savedTrips.unshift(record);
  }
  state.savedTrips = dedupeTripsByDate(state.savedTrips);
  writeSavedTrips();
  return record;
}

function getSelectedTrip({ fallback = true } = {}) {
  const selected = state.savedTrips.find((trip) => trip.id === state.selectedTripId) || null;
  return selected || (fallback ? state.savedTrips[0] || null : null);
}

function getTripMapState(trip) {
  if (!trip) return 'before';
  const isActiveTrip = trip.id === state.activeTripId;
  if (trip.status === 'recording' && isActiveTrip) return 'recording';
  if (trip.status === 'recorded' && isActiveTrip && !(trip.diary && trip.diary.length)) return 'after';
  return 'before';
}

function syncSelectedTripView() {
  const trip = getSelectedTrip();
  if (!trip) {
    state.trip = {
      title: elements.tripTitle.value.trim() || '새 여행',
      date: elements.tripDate.value,
      region: elements.tripRegion.value.trim() || '미정 지역',
    };
    state.generatedDiary = null;
    state.diaryUnlocked = false;
    state.acceptedPhotoIds = new Set();
    state.rejectedPhotoIds = new Set();
    updateTripTexts();
    renderTripHistory();
    renderTimeline(state.sampleTimeline);
    updateNavButtons();
    setMapState('before');
    return null;
  }

  state.trip = {
    title: trip.title,
    date: trip.date,
    region: trip.region,
  };
  state.calendarSelectedDateKey = normalizeDateKey(trip.date);
  if (String(trip.id || '').startsWith('trip_')) {
    state.tripId = trip.id;
    saveLastTripId(trip.id);
  }
  state.generatedDiary = trip.diary && trip.diary.length ? trip.diary : null;
  state.diaryUnlocked = Boolean(state.generatedDiary);
  state.locationSamples = trip.recording?.samples ?? [];
  state.acceptedPhotoIds = new Set((trip.feedback?.acceptedPhotoIds || []).map(String));
  state.rejectedPhotoIds = new Set((trip.feedback?.rejectedPhotoIds || []).map(String));
  updateTripTexts();
  renderTripHistory();
  renderTimeline(state.generatedDiary || state.sampleTimeline);
  updateNavButtons();
  setMapState(getTripMapState(trip));
  return trip;
}

function pickTrip(tripId) {
  state.selectedTripId = tripId;
  const trip = syncSelectedTripView();
  if (!trip) return;
  state.calendarSelectedDateKey = normalizeDateKey(trip.date);
  if (state.screen === 'map') renderTripOnMap(trip);
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

async function parsePhotoFile(file) {
  const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), fileToPreviewDataUrl(file)]);
  const exif = parseExifBuffer(buffer);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `photo_${Math.random().toString(16).slice(2)}`,
    fileName: file.name,
    dataUrl,
    takenAt: exif.takenAt || new Date(file.lastModified || Date.now()),
    lat: exif.lat ?? null,
    lng: exif.lng ?? null,
  };
}

async function fileToPreviewDataUrl(file, maxDimension = 1600, quality = 0.82) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return await fileToDataUrl(file);

    const ratio = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * ratio));
    const targetHeight = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return await fileToDataUrl(file);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return await fileToDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
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
  // 촬영시각이 이동기록과 30분 이상 떨어져 있으면 매칭하지 않는다.
  // (과거 앨범 사진이 '지금' 위치에 잘못 찍히는 것 방지)
  if (bestGap > PHOTO_LOCATION_MATCH_WINDOW_MS) return null;
  return best;
}

function findLocationSamplesAround(targetTime) {
  if (!state.locationSamples.length || !targetTime) return { before: null, after: null };
  const target = targetTime.getTime();
  let before = null;
  let after = null;

  for (const sample of state.locationSamples) {
    if (typeof sample.lng !== 'number' || typeof sample.lat !== 'number') continue;
    if (sample.timestamp <= target && (!before || sample.timestamp > before.timestamp)) {
      before = sample;
    }
    if (sample.timestamp >= target && (!after || sample.timestamp < after.timestamp)) {
      after = sample;
    }
  }

  return { before, after };
}

function estimatePhotoLocation(photo) {
  if (Number.isFinite(photo.lat) && Number.isFinite(photo.lng)) {
    return { lat: photo.lat, lng: photo.lng, source: 'exif' };
  }
  if (!photo.takenAt) return null;

  const { before, after } = findLocationSamplesAround(photo.takenAt);
  if (before && after && before.timestamp !== after.timestamp) {
    const target = photo.takenAt.getTime();
    const ratio = (target - before.timestamp) / (after.timestamp - before.timestamp);
    const clamped = Math.max(0, Math.min(1, ratio));
    return {
      lat: before.lat + (after.lat - before.lat) * clamped,
      lng: before.lng + (after.lng - before.lng) * clamped,
      source: 'interpolated',
    };
  }

  const nearest = findNearestLocationSample(photo.takenAt);
  if (!nearest || typeof nearest.lng !== 'number' || typeof nearest.lat !== 'number') return null;
  return { lat: nearest.lat, lng: nearest.lng, source: 'nearest' };
}

function centerMapOn(lngLat, zoom = 15.5) {
  if (!state.map) return;
  state.map.easeTo({
    center: lngLat,
    zoom,
    duration: 700,
  });
}

function ensureRouteLayer() {
  if (!state.map || !state.map.isStyleLoaded()) return false;
  if (state.map.getSource('trip-route-source')) return true;
  state.map.addSource('trip-route-source', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [],
      },
      properties: {},
    },
  });
  state.map.addLayer({
    id: 'trip-route-line',
    type: 'line',
    source: 'trip-route-source',
    paint: {
      'line-color': '#c86f4f',
      'line-width': 4,
      'line-opacity': 0.92,
    },
  });
  return true;
}

function setRouteLine(coordinates) {
  if (!state.map) return;
  state.pendingRouteCoordinates = coordinates;
  if (!state.map.isStyleLoaded()) {
    if (!state.routeRenderQueued) {
      state.routeRenderQueued = true;
      state.map.once('idle', () => {
        state.routeRenderQueued = false;
        setRouteLine(state.pendingRouteCoordinates || []);
      });
    }
    return;
  }
  if (!ensureRouteLayer()) return;
  const source = state.map.getSource('trip-route-source');
  if (!source) return;
  source.setData({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {},
  });
}

function isValidLngLat(lngLat) {
  return Array.isArray(lngLat) && Number.isFinite(lngLat[0]) && Number.isFinite(lngLat[1]);
}

function sortByTakenAt(left, right) {
  return new Date(left.takenAt || 0) - new Date(right.takenAt || 0);
}

function getTripPhotoMapPoints(trip) {
  const points = [];
  const seen = new Set();
  const addPoint = ({ lngLat, tip = '', imageUrl = '', id = '' }) => {
    if (!isValidLngLat(lngLat)) return;
    const key = id || `${lngLat[0].toFixed(6)},${lngLat[1].toFixed(6)},${tip}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ lngLat, tip, imageUrl });
  };

  (trip?.diary || []).forEach((entry, index) => {
    addPoint({
      lngLat: Array.isArray(entry.center) ? entry.center : null,
      tip: entry.timestamp ? formatTipTime(entry.timestamp) : '',
      imageUrl: entry.mainPhoto || entry.photoUrls?.[0] || '',
      id: entry.photoId || `diary_${index}`,
    });
  });

  if (!points.length) {
    (trip?.recording?.livePhotos || [])
      .filter((photo) => Number.isFinite(photo.lng) && Number.isFinite(photo.lat))
      .sort(sortByTakenAt)
      .forEach((photo) => {
        addPoint({
          lngLat: [photo.lng, photo.lat],
          tip: photo.takenAt ? formatTipTime(photo.takenAt) : '',
          imageUrl: photo.dataUrl || '',
          id: photo.id,
        });
      });
  }

  if (!points.length) {
    (trip?.photos || [])
      .filter((photo) => Number.isFinite(photo.lng) && Number.isFinite(photo.lat))
      .sort(sortByTakenAt)
      .forEach((photo) => {
        addPoint({
          lngLat: [photo.lng, photo.lat],
          tip: photo.takenAt ? formatTipTime(photo.takenAt) : '',
          imageUrl: photo.dataUrl || photo.url || '',
          id: photo.id,
        });
      });
  }

  return points;
}

function getSamplePoints(trip) {
  return (trip?.recording?.samples || [])
    .filter((sample) => Number.isFinite(sample.lng) && Number.isFinite(sample.lat))
    .map((sample) => ({
      lngLat: [sample.lng, sample.lat],
      tip: sample.timestamp ? formatTipTime(sample.timestamp) : '',
    }));
}

function getTripRouteFootprintPoints(trip) {
  return (trip?.recording?.footprints || [])
    .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat))
    .map((point) => ({
      lngLat: [point.lng, point.lat],
      tip: point.timestamp ? formatTipTime(point.timestamp) : '',
    }));
}

function getLastSamplePoint(samplePoints) {
  return samplePoints[samplePoints.length - 1] || null;
}

function renderTripOnMap(trip) {
  if (!state.map) return;
  // 지도 스타일이 아직 로드 전이면 로드 완료 후 다시 그린다 (경로선 addSource 실패 방지)
  if (!state.map.isStyleLoaded()) {
    state.map.once('idle', () => renderTripOnMap(trip));
    return;
  }
  clearLiveMarkers();
  ensureRouteLayer();

  const samplePoints = getSamplePoints(trip);
  const photoPoints = getTripPhotoMapPoints(trip);
  const routePoints = samplePoints.length ? samplePoints : photoPoints;
  setRouteLine(routePoints.map((point) => point.lngLat));

  getTripRouteFootprintPoints(trip).forEach((point) => {
    addFootprint(point.lngLat, point.tip);
  });

  photoPoints.forEach((point) => {
    if (point.imageUrl) {
      addLivePhotoMarker(point.lngLat, point.imageUrl);
    } else {
      addFootprint(point.lngLat, point.tip);
    }
  });

  const last = getLastSamplePoint(samplePoints);
  if (last) {
    ensureCurrentMarker(last.lngLat);
  }
  if (photoPoints.length) {
    focusMapOnPoints(photoPoints);
  } else if (last) {
    centerMapOn(last.lngLat, 15.5);
  } else if (samplePoints.length) {
    focusMapOnPoints(samplePoints);
  }
}

function renderTripHistory() {
  if (!elements.tripHistory) return;
  if (!state.savedTrips.length) {
    elements.tripHistory.innerHTML = '<span class="trip-chip">저장된 여행이 아직 없어요.</span>';
    return;
  }

  elements.tripHistory.innerHTML = state.savedTrips
    .map((trip) => {
      const active = trip.id === state.selectedTripId;
      return `
        <button class="trip-history-button ${active ? 'is-active' : ''}" type="button" data-trip-id="${trip.id}">
          ${trip.date} · ${trip.title}
        </button>
      `;
    })
    .join('');

  elements.tripHistory.querySelectorAll('[data-trip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      pickTrip(button.dataset.tripId);
    });
  });
}

function updateTripTexts() {
  const { title, date, region } = state.trip;
  const displayTitle = title || '새 여행';
  const summary = [displayTitle, date ? formatDateLabel(date) : null, region]
    .filter(Boolean)
    .join(' · ');
  elements.tripSummaryText.textContent = summary;
  elements.diarySummaryText.textContent = summary;
  document.title = `${displayTitle} · Travel Diary`;
}

function buildApiUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

// 백엔드가 주는 상대경로(/uploads/..)를 절대 URL로 변환
function toAbsolutePhotoUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url;
  return buildApiUrl(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateNavButtons() {
  elements.navButtons.forEach((button) => {
    const target = button.dataset.nav;
    button.classList.toggle('is-active', state.screen === target);
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    if (target === 'diary') {
      button.title = '다이어리 보기';
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
  state.map.on('load', () => {
    ensureRouteLayer();
    const trip = getSelectedTrip();
    if (trip) {
      renderTripOnMap(trip);
    }
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
  const isActiveTrip = state.selectedTripId && state.selectedTripId === state.activeTripId;
  elements.recordingBadge.hidden = mapState !== 'recording';
  elements.photoImportPanel.hidden = !(mapState === 'after' && isActiveTrip);
  elements.startRecording.hidden = mapState !== 'before' || !isActiveTrip;
  elements.endRecording.hidden = mapState !== 'recording';
  if (elements.livePhotoButton) {
    elements.livePhotoButton.hidden = mapState !== 'recording';
  }
  if (!isActiveTrip) {
    elements.startRecording.hidden = true;
    elements.endRecording.hidden = true;
    elements.photoImportPanel.hidden = true;
    if (elements.livePhotoButton) elements.livePhotoButton.hidden = true;
  }
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

async function flushLocationQueue({ force = false } = {}) {
  if (!state.tripId || state.locationSyncInFlight || !state.pendingLocationPoints.length) return false;
  const now = Date.now();
  if (
    !force &&
    state.pendingLocationPoints.length < LOCATION_SYNC_BATCH_SIZE &&
    now - state.lastLocationSyncAt < LOCATION_SYNC_MIN_INTERVAL_MS
  ) {
    return false;
  }

  const points = state.pendingLocationPoints.slice();
  const body = JSON.stringify({ points });
  state.locationSyncInFlight = true;
  try {
    const response = await fetch(buildApiUrl(`/api/trips/${state.tripId}/locations`), {
      method: 'POST',
      keepalive: force && body.length <= 60000,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Location sync failed: ${response.status}`);
    }
    state.pendingLocationPoints.splice(0, points.length);
    state.lastLocationSyncAt = Date.now();
    return true;
  } catch (error) {
    console.warn('위치 기록 서버 저장 실패(로컬에는 저장됨):', error);
    return false;
  } finally {
    state.locationSyncInFlight = false;
  }
}

function queueLocationForApi(position) {
  state.pendingLocationPoints.push({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    time: new Date(position.timestamp || Date.now()).toISOString(),
    accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  });
  flushLocationQueue();
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
  if (state.map && state.map.getSource('trip-route-source')) {
    setRouteLine([]);
  }
}

// tip: 커서를 올렸을 때 보여줄 간단 정보 (예: '7월 16일 · 오후 2:30')
function addFootprint(lngLat, tip) {
  if (!state.map) return;
  const el = makeFootprintElement();
  if (tip) el.setAttribute('data-tip', tip);
  const marker = new window.mapboxgl.Marker({
    element: el,
    anchor: 'center',
  })
    .setLngLat(lngLat)
    .addTo(state.map);
  state.footprintMarkers.push(marker);
}

// 발자취 툴팁용 시간 포맷: '7월 16일 · 오후 2:30'
function formatTipTime(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const md = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date);
  const hm = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(date);
  return `${md} · ${hm}`;
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
  if (state.activeTrip) {
    state.activeTrip.recording.samples.push({
      lng: lngLat[0],
      lat: lngLat[1],
      timestamp,
    });
    setRouteLine(state.activeTrip.recording.samples.map((sample) => [sample.lng, sample.lat]));
    upsertSavedTrip(state.activeTrip);
  }
  queueLocationForApi(position);

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
    addFootprint(lngLat, formatTipTime(timestamp));
    if (state.activeTrip) {
      state.activeTrip.recording.footprints.push({
        lng: lngLat[0],
        lat: lngLat[1],
        timestamp,
      });
      upsertSavedTrip(state.activeTrip);
    }
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
      ? '위치 권한이 필요해요. 브라우저에서 위치 사용을 허용해 주세요.'
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

  if (!state.activeTrip) {
    ensureActiveTripForMap();
  }

  clearLiveMarkers();
  state.locationSamples = [];
  state.pendingLocationPoints = [];
  state.lastLocationSyncAt = 0;
  state.generatedDiary = null;
  state.diaryUnlocked = false;
  updateNavButtons();

  stopTracking();
  state.recordingStartedAt = Date.now();
  state.recordingBonusSeconds = 0;
  state.recordingElapsed = 0;
  if (state.activeTrip) {
    state.activeTrip.recording = {
      startedAt: null,
      endedAt: null,
      elapsed: 0,
      samples: [],
      footprints: [],
      livePhotos: state.activeTrip.recording?.livePhotos ?? [],
    };
    state.activeTrip.recording.startedAt = new Date(state.recordingStartedAt).toISOString();
    state.activeTrip.status = 'recording';
    upsertSavedTrip(state.activeTrip);
  }
  updateRecordingTimer();
  setMapState('recording');

  state.watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 15000,
  });

  state.recordingTimer = window.setInterval(updateRecordingTimer, 1000);

  // 첫 위치 받으면 여행 제목 자동 채우기
  const initialWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      navigator.geolocation.clearWatch(initialWatchId);
      suggestTitleFromLocation(lng, lat);
    },
    () => {}, // 에러 무시
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

function endRecording() {
  stopTracking();
  updateRecordingTimer();
  flushLocationQueue({ force: true });
  setMapState('after');
  if (state.activeTrip) {
    state.activeTrip.recording.endedAt = new Date().toISOString();
    state.activeTrip.recording.elapsed = state.recordingElapsed;
    state.activeTrip.status = 'recorded';
    upsertSavedTrip(state.activeTrip);
  }
  state.diaryUnlocked = false;
  updateNavButtons();

  // 기록 중 찍은 현장 사진이 있으면 바로 다이어리로 정리
  // 백엔드가 연결돼 있으면 업로드해서 AI 선별(품질평가·중복제거) 파이프라인을 태운다.
  const livePhotoData = livePhotosAsPhotoData();
  if (livePhotoData.length) {
    (async () => {
      if (state.tripId) {
        try {
          const files = await Promise.all(
            livePhotoData.map((p) => dataUrlToFile(p.dataUrl, p.fileName)),
          );
          await uploadPhotosToApi(files);
          const usedBackend = await generateDiaryFromBackend();
          if (usedBackend) return;
        } catch (error) {
          console.warn('현장 사진 백엔드 선별 실패, 로컬 처리로 폴백:', error);
        }
      }
      await generateDiaryFromPhotoData(livePhotoData);
    })().catch((error) => {
      console.error(error);
      showToast('현장 사진 정리 중 오류가 발생했어요.');
    });
    return;
  }
  showToast('오늘의 여정이 사진첩과 연결되었습니다. 사진 불러오기 버튼을 눌러 주세요.');
  return;
}

// dataURL → File 변환 (현장 사진을 백엔드에 업로드할 때 사용)
async function dataUrlToFile(dataUrl, fileName = 'live-photo.jpg') {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
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
      const distanceToCenter = distanceMeters(lastGroup.center, photoPoint);
      if (
        gap <= PHOTO_SPOT_GAP_MS &&
        distanceToAnchor <= PHOTO_SPOT_RADIUS_M &&
        distanceToCenter <= PHOTO_SPOT_RADIUS_M
      ) {
        lastGroup.photos.push(photo);
        lastGroup.lastTakenAt = photoTime;
        lastGroup.center = [
          (lastGroup.center[0] * (lastGroup.photos.length - 1) + photo.lng) / lastGroup.photos.length,
          (lastGroup.center[1] * (lastGroup.photos.length - 1) + photo.lat) / lastGroup.photos.length,
        ];
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

function getPhotoPreferenceWeight(photo) {
  const id = String(photo?.id ?? '');
  if (state.acceptedPhotoIds.has(id)) return 2;
  if (state.rejectedPhotoIds.has(id)) return -1;
  return 0;
}

function getPhotoTimeValue(photo) {
  const time = photo?.takenAt instanceof Date ? photo.takenAt.getTime() : new Date(photo?.takenAt || 0).getTime();
  return Number.isFinite(time) ? time : null;
}

function getPhotoStableId(photo, index = 0) {
  return String(photo?.id || photo?.photo_id || photo?.fileName || `${getPhotoTimeValue(photo) || 'photo'}_${index}`);
}

function arePhotosTooSimilar(left, right) {
  const leftTime = getPhotoTimeValue(left);
  const rightTime = getPhotoTimeValue(right);
  if (leftTime === null || rightTime === null) return false;
  if (Math.abs(leftTime - rightTime) > SIMILAR_PHOTO_GAP_MS) return false;

  const hasBothLocations = Number.isFinite(left?.lat) &&
    Number.isFinite(left?.lng) &&
    Number.isFinite(right?.lat) &&
    Number.isFinite(right?.lng);
  if (!hasBothLocations) return true;

  return distanceMeters([left.lng, left.lat], [right.lng, right.lat]) <= SIMILAR_PHOTO_DISTANCE_M;
}

function selectRepresentativePhotos(photos, maxCount = REPRESENTATIVE_PHOTOS_PER_SPOT) {
  const ranked = photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const preferenceDiff = getPhotoPreferenceWeight(b.photo) - getPhotoPreferenceWeight(a.photo);
      if (preferenceDiff) return preferenceDiff;
      const imageDiff = Number(Boolean(b.photo.url || b.photo.dataUrl)) - Number(Boolean(a.photo.url || a.photo.dataUrl));
      if (imageDiff) return imageDiff;
      return a.index - b.index;
    });

  const selected = [];
  const selectedIds = new Set();
  const pick = (items, enforceSimilarity = true) => {
    for (const { photo, index } of items) {
      if (selected.length >= maxCount) return;
      const id = getPhotoStableId(photo, index);
      if (selectedIds.has(id)) continue;
      if (enforceSimilarity && selected.some((chosen) => arePhotosTooSimilar(chosen, photo))) continue;
      selected.push(photo);
      selectedIds.add(id);
    }
  };

  const preferred = ranked.filter(({ photo }) => getPhotoPreferenceWeight(photo) >= 0);
  const rejected = ranked.filter(({ photo }) => getPhotoPreferenceWeight(photo) < 0);
  pick(preferred, true);
  pick(rejected, true);
  return selected;
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

function canAutoTitle() {
  // 사용자가 직접 넣은 제목이 있으면 유지. 비었거나 기본값('새 여행')이면 교체 가능.
  const current = (state.trip.title || '').trim();
  return !current || current === '새 여행';
}

function applySuggestedTitle(title) {
  if (!title) return;
  state.trip.title = title;
  if (elements.tripTitle) elements.tripTitle.value = title;
  if (state.activeTrip) {
    state.activeTrip.title = title;
    upsertSavedTrip(state.activeTrip);
  }
  updateTripTexts();
  renderTripHistory();
}

async function suggestTitleFromLocation(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  if (!canAutoTitle()) return;
  const placeName = await resolvePlaceName(lng, lat, '');
  if (!placeName) return;
  applySuggestedTitle(`${placeName.split(',')[0].trim()} 여행`);
}

// 도시(동네보다 넓은) 단위 지명
async function resolveRegionName(lng, lat) {
  if (!MAPBOX_ACCESS_TOKEN) return '';
  try {
    const endpoint = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
    endpoint.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    endpoint.searchParams.set('language', 'ko');
    endpoint.searchParams.set('types', 'locality,place');
    endpoint.searchParams.set('limit', '1');
    const response = await fetch(endpoint.toString());
    if (!response.ok) return '';
    const data = await response.json();
    return data.features?.[0]?.text || '';
  } catch {
    return '';
  }
}

// 다이어리 전체를 보고 제목 짓기:
// - 스팟들의 장소명 빈도 + 여행이 하루를 채웠는지 + 시간대를 종합
// - 동네가 하나면 '연남동에서의 오후', 여러 동네면 도시 단위로 '서울에서의 하루'
async function suggestTitleFromEntries(entries) {
  if (!canAutoTitle()) return;
  const spots = (entries || []).filter((e) => e && (e.place || Array.isArray(e.center)));
  if (!spots.length) return;

  // 장소명 첫 토큰 빈도 집계
  const counts = new Map();
  spots.forEach((e) => {
    const token = (e.place || '').split(',')[0].trim();
    if (token && !/^기록 스팟/.test(token)) counts.set(token, (counts.get(token) || 0) + 1);
  });
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  // 여행의 시간 범위 → 하루/시간대 표현
  const times = spots
    .map((e) => (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  const spanHours = times.length >= 2 ? (times[times.length - 1] - times[0]) / 3600000 : 0;
  const mid = times.length ? times[Math.floor(times.length / 2)] : null;
  const h = mid ? mid.getHours() : null;
  const daypart =
    h === null ? '' :
    h < 5 ? '깊은 밤' : h < 11 ? '아침' : h < 15 ? '한낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';

  let anchor = ranked.length ? ranked[0][0] : '';
  // 동네가 3곳 이상 흩어져 있으면 도시 단위 지명으로 넓힌다 (중심 좌표 기준)
  if (ranked.length >= 3) {
    const coords = spots.filter((e) => Array.isArray(e.center));
    if (coords.length) {
      const cLng = coords.reduce((a, e) => a + e.center[0], 0) / coords.length;
      const cLat = coords.reduce((a, e) => a + e.center[1], 0) / coords.length;
      const region = await resolveRegionName(cLng, cLat);
      if (region) anchor = region;
    }
  }
  if (!anchor && spots.some((e) => Array.isArray(e.center))) {
    const first = spots.find((e) => Array.isArray(e.center));
    anchor = (await resolvePlaceName(first.center[0], first.center[1], '')).split(',')[0].trim();
  }
  if (!anchor) return;

  const title = spanHours >= 5
    ? `${anchor}에서의 하루`
    : daypart ? `${anchor}에서의 ${daypart}` : `${anchor} 여행`;
  applySuggestedTitle(title);
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
  return minute === 0 ? `${period} ${displayHour}시` : `${period} ${displayHour}시 30분`;
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

function getEntryPhotoUrls(entry) {
  const urls = Array.isArray(entry?.photo_urls) && entry.photo_urls.length
    ? entry.photo_urls
    : entry?.photo_url
      ? [entry.photo_url]
      : [];
  return urls.map((url) => toAbsolutePhotoUrl(url)).filter(Boolean);
}

function getEntryPhotoIds(entry, diary, index, count) {
  if (Array.isArray(entry?.photo_ids) && entry.photo_ids.length) return entry.photo_ids;
  return diary.selected_photos?.slice(index, index + count).map((photo) => photo.photo_id) || [];
}

function diaryFromApi(diary) {
  if (!diary) return null;
  const timeline = Array.isArray(diary.timeline) ? diary.timeline : [];
  return timeline.map((entry, index) => {
    const entryDate = new Date(entry.time);
    const photoUrls = getEntryPhotoUrls(entry);
    const photoCount = Number.isFinite(entry.photo_count)
      ? entry.photo_count
      : photoUrls.length || (entry.photo_url ? 1 : 0);
    return {
      photoId: entry.photo_ids?.[0] || diary.selected_photos?.[index]?.photo_id || entry.photo_url || index,
      photoIds: getEntryPhotoIds(entry, diary, index, photoCount),
      time: formatRoundedTimeLabel(entryDate),
      dateLabel: `${formatMonthDay(entryDate)} · ${diary.title || state.trip.title || '여행'}`,
      place: entry.place,
      note: entry.note,
      photoCount,
      photoUrls,
      center: Number.isFinite(entry.lng) && Number.isFinite(entry.lat) ? [entry.lng, entry.lat] : null,
      timestamp: entryDate,
      durationMinutes: null,
    };
  });
}

function locationSamplesFromApi(locations = []) {
  return (Array.isArray(locations) ? locations : [])
    .map((point) => {
      const timestamp = new Date(point.time || point.timestamp || point.takenAt || 0).getTime();
      return {
        lng: Number(point.lng),
        lat: Number(point.lat),
        timestamp,
      };
    })
    .filter((point) =>
      Number.isFinite(point.lng) &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.timestamp),
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildFootprintsFromSamples(samples) {
  const footprints = [];
  let lastLngLat = null;
  let lastTimestamp = 0;
  samples.forEach((sample) => {
    const lngLat = [sample.lng, sample.lat];
    const distanceFromLast = lastLngLat ? distanceMeters(lastLngLat, lngLat) : Infinity;
    const timeSinceLast = sample.timestamp - lastTimestamp;
    const shouldDrop =
      !lastLngLat ||
      (timeSinceLast >= FOOTPRINT_MIN_GAP_MS && distanceFromLast > FOOTPRINT_MIN_REPEAT_DISTANCE_M);
    if (!shouldDrop) return;
    footprints.push({
      lng: sample.lng,
      lat: sample.lat,
      timestamp: sample.timestamp,
    });
    lastLngLat = lngLat;
    lastTimestamp = sample.timestamp;
  });
  return footprints;
}

function buildRecordingFromLocations(locations = []) {
  const samples = locationSamplesFromApi(locations);
  const first = samples[0] || null;
  const last = samples[samples.length - 1] || null;
  return {
    startedAt: first ? new Date(first.timestamp).toISOString() : null,
    endedAt: last ? new Date(last.timestamp).toISOString() : null,
    elapsed: first && last ? Math.max(0, Math.round((last.timestamp - first.timestamp) / 1000)) : 0,
    samples,
    footprints: buildFootprintsFromSamples(samples),
    livePhotos: [],
  };
}

function buildRecordingFromPhotoFallback(photos = []) {
  const samples = photos
    .filter((photo) => Number.isFinite(photo.lng) && Number.isFinite(photo.lat))
    .map((photo) => ({
      lng: photo.lng,
      lat: photo.lat,
      timestamp: new Date(photo.takenAt || Date.now()).getTime(),
    }))
    .filter((sample) => Number.isFinite(sample.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    startedAt: samples[0] ? new Date(samples[0].timestamp).toISOString() : null,
    endedAt: samples[samples.length - 1] ? new Date(samples[samples.length - 1].timestamp).toISOString() : null,
    elapsed: samples.length > 1 ? Math.max(0, Math.round((samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000)) : 0,
    samples,
    footprints: buildFootprintsFromSamples(samples),
    livePhotos: [],
  };
}

function savedTripFromServer(item) {
  if (!item?.trip_id || !item?.diary) return null;
  const diary = {
    ...item.diary,
    title: item.title || item.diary.title || '여행 다이어리',
  };
  const entries = diaryFromApi(diary);
  if (!entries?.length) return null;

  const firstTimestamp = entries.find((entry) => entry.timestamp instanceof Date && !Number.isNaN(entry.timestamp.getTime()))?.timestamp;
  const date = normalizeDateKey(item.date || firstTimestamp || new Date());
  const title = item.title || diary.title || '여행 다이어리';
  const photos = entries
    .filter((entry) => Array.isArray(entry.center) && Number.isFinite(entry.center[0]) && Number.isFinite(entry.center[1]))
    .map((entry, index) => ({
      id: String(entry.photoId || `${item.trip_id}_photo_${index}`),
      dataUrl: entry.photoUrls?.[0] || null,
      takenAt: (entry.timestamp instanceof Date && !Number.isNaN(entry.timestamp.getTime())
        ? entry.timestamp
        : new Date()).toISOString(),
      lng: entry.center[0],
      lat: entry.center[1],
    }));
  const serverRecording = buildRecordingFromLocations(item.locations || []);
  const fallbackRecording = buildRecordingFromPhotoFallback(photos);
  const recording = hasRouteRecording(serverRecording) ? serverRecording : fallbackRecording;

  return {
    id: item.trip_id,
    title,
    date,
    region: item.region || '미정 지역',
    createdAt: firstTimestamp ? firstTimestamp.toISOString() : new Date().toISOString(),
    status: 'completed',
    recording,
    diary: entries,
    photos,
    feedback: {
      acceptedPhotoIds: [],
      rejectedPhotoIds: [],
    },
  };
}

async function syncServerTrips() {
  const response = await fetch(buildApiUrl('/api/trips'));
  if (!response.ok) return 0;
  const payload = await response.json();
  const serverTrips = Array.isArray(payload?.trips)
    ? payload.trips.map(savedTripFromServer).filter(Boolean)
    : [];
  if (!serverTrips.length) return 0;

  for (let i = serverTrips.length - 1; i >= 0; i -= 1) {
    upsertSavedTrip(serverTrips[i]);
  }

  const lastTripId = loadLastTripId();
  const lastTrip = lastTripId ? state.savedTrips.find((trip) => trip.id === lastTripId) : null;
  const selectedStillExists = state.savedTrips.some((trip) => trip.id === state.selectedTripId);
  if (lastTrip) {
    state.selectedTripId = lastTrip.id;
  } else if (!selectedStillExists) {
    state.selectedTripId = state.savedTrips[0]?.id || null;
  }

  syncSelectedTripView();
  if (state.calendarOpen) renderCalendar();
  return serverTrips.length;
}

async function restoreLastTrip() {
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
    const [diaryResponse, photosResponse, locationsResponse] = await Promise.all([
      fetch(buildApiUrl(`/api/trips/${tripId}/diary`)),
      fetch(buildApiUrl(`/api/trips/${tripId}/photos`)),
      fetch(buildApiUrl(`/api/trips/${tripId}/locations`)),
    ]);
    if (!diaryResponse.ok) return false;

    const diary = await diaryResponse.json();
    const restoredEntries = diaryFromApi(diary);
    if (!restoredEntries?.length) return false;

    let restoredPhotoCount = 0;
    let restoredPhotoRecords = [];
    if (photosResponse.ok) {
      const photosPayload = await photosResponse.json();
      const restoredPhotos = Array.isArray(photosPayload?.photos) ? photosPayload.photos : [];
      restoredPhotoCount = restoredPhotos.length;
      state.photoUrls = restoredPhotos
        .map((photo) => photo?.filename ? buildApiUrl(`/uploads/${photo.filename}`) : null)
        .filter(Boolean);
      restoredPhotoRecords = restoredPhotos.map((photo, index) => ({
        id: String(photo.photo_id || `${tripId}_photo_${index}`),
        fileName: photo.filename || '',
        url: photo.filename ? buildApiUrl(`/uploads/${photo.filename}`) : '',
        takenAt: photo.taken_at || new Date().toISOString(),
        lat: Number.isFinite(photo.lat) ? photo.lat : null,
        lng: Number.isFinite(photo.lng) ? photo.lng : null,
      }));
    }

    let restoredLocations = [];
    if (locationsResponse.ok) {
      const locationsPayload = await locationsResponse.json();
      restoredLocations = Array.isArray(locationsPayload?.locations) ? locationsPayload.locations : [];
    }
    const serverRecording = buildRecordingFromLocations(restoredLocations);
    const fallbackRecording = buildRecordingFromPhotoFallback(restoredPhotoRecords);
    const recording = hasRouteRecording(serverRecording) ? serverRecording : fallbackRecording;
    const restoredTrip = {
      id: tripId,
      title: diary.title || state.trip.title || '여행 다이어리',
      date: normalizeDateKey(state.trip.date || diary.timeline?.[0]?.time || new Date()),
      region: state.trip.region || '미정 지역',
      createdAt: recording.startedAt || new Date().toISOString(),
      status: 'completed',
      recording,
      diary: restoredEntries,
      photos: restoredPhotoRecords,
      feedback: {
        acceptedPhotoIds: Array.from(state.acceptedPhotoIds),
        rejectedPhotoIds: Array.from(state.rejectedPhotoIds),
      },
    };
    upsertSavedTrip(restoredTrip);

    state.tripId = tripId;
    state.selectedTripId = tripId;
    state.activeTripId = tripId;
    state.activeTrip = restoredTrip;
    state.locationSamples = recording.samples;
    state.generatedDiary = restoredEntries;
    state.diaryUnlocked = true;
    state.trip = {
      title: restoredTrip.title,
      date: restoredTrip.date,
      region: restoredTrip.region,
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

// 백엔드 AI 파이프라인(/generate)으로 다이어리 생성 — 위치별 대표사진 1장 자동 선별
async function generateDiaryFromBackend() {
  if (!state.tripId) return false;
  let data;
  try {
    const response = await fetch(buildApiUrl(`/api/trips/${state.tripId}/generate`), { method: 'POST' });
    if (!response.ok) throw new Error(`generate failed: ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.error(error);
    return false;
  }

  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  if (!timeline.length) return false;

  const entries = timeline.map((entry, index) => {
    const when = entry.time ? new Date(entry.time) : null;
    const photoUrls = getEntryPhotoUrls(entry);
    const photo = photoUrls[0] || '';
    const hasCenter = Number.isFinite(entry.lng) && Number.isFinite(entry.lat);
    return {
      photoId: entry.photo_ids?.[0] || entry.photo_url || index,
      photoIds: Array.isArray(entry.photo_ids) ? entry.photo_ids : [],
      time: when && !Number.isNaN(when.getTime()) ? formatRoundedTimeLabel(when) : '',
      place: entry.place || `기록 스팟 ${index + 1}`,
      note: entry.note || '',
      photoUrls,
      mainPhoto: photo || null,
      photoCount: Number.isFinite(entry.photo_count) ? entry.photo_count : photoUrls.length || 1,
      center: hasCenter ? [entry.lng, entry.lat] : null,
      timestamp: when && !Number.isNaN(when.getTime()) ? when : new Date(),
      dateLabel: data.title || state.trip.title || '여행',
    };
  });

  state.generatedDiary = entries;
  state.diaryUnlocked = true;
  if (state.activeTrip) {
    state.activeTrip.status = 'completed';
    state.activeTrip.diary = entries;
    state.activeTrip.photos = entries
      .filter((e) => e.center)
      .map((e, i) => ({
        id: `sel_${i}`,
        dataUrl: e.mainPhoto,
        takenAt: (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)).toISOString(),
        lng: e.center[0],
        lat: e.center[1],
      }));
    upsertSavedTrip(state.activeTrip);
    renderTripOnMap(state.activeTrip);
  }
  // 다이어리 전체(장소 빈도·시간 범위)를 보고 자동 제목. 실패 시 백엔드 제목으로 폴백.
  await suggestTitleFromEntries(entries);
  if (!(state.trip.title || '').trim() && data.title) {
    state.trip.title = data.title;
    if (state.activeTrip) { state.activeTrip.title = data.title; upsertSavedTrip(state.activeTrip); }
    updateTripTexts();
  }
  updateNavButtons();
  renderTripHistory();
  renderTimeline(entries);
  setScreen('diary');
  showToast('AI가 위치별 대표 사진을 골라 다이어리를 만들었어요 ✨');
  return true;
}

// 활성 여행의 현장 사진(livePhotos)을 photoData 형태로 변환
function livePhotosAsPhotoData() {
  const live = state.activeTrip?.recording?.livePhotos || [];
  return live
    .filter((p) => p.dataUrl && Number.isFinite(p.lng) && Number.isFinite(p.lat))
    .map((p) => ({
      id: p.id,
      fileName: p.fileName || 'live-photo.jpg',
      dataUrl: p.dataUrl,
      takenAt: new Date(p.takenAt),
      lat: p.lat,
      lng: p.lng,
    }));
}

// 장소·시각·머문시간 기반의 다이어리풍 메모 초안.
// 안내 문구는 메모에 넣지 않는다 — 편집 UI에서 회색 힌트로 따로 보여준다.
function makeDraftNote({ place, timestamp, durationMinutes }) {
  const spot = (place || '이곳').split(',')[0].trim() || '이곳';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const valid = !Number.isNaN(date.getTime());
  const h = valid ? date.getHours() : null;
  const part =
    h === null ? '여행 중' :
    h < 5 ? '깊은 밤' :
    h < 11 ? '아침' :
    h < 15 ? '한낮' :
    h < 18 ? '오후' :
    h < 21 ? '저녁' : '밤';
  const timeText = valid
    ? new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(date)
    : '';
  const stay =
    durationMinutes >= 60 ? `${Math.round(durationMinutes / 60)}시간 가까이 머물렀다` :
    durationMinutes > 3 ? `${durationMinutes}분쯤 머물렀다` :
    '잠시 걸음을 멈췄다';
  return timeText
    ? `${part}의 ${spot}, ${timeText}. ${stay}.`
    : `${part}의 ${spot}. ${stay}.`;
}

async function generateDiaryFromFiles(files) {
  const parsed = [];
  for (const file of files) {
    try {
      parsed.push(await parsePhotoFile(file));
    } catch (error) {
      console.error('Failed to read photo file:', file?.name, error);
    }
  }
  // 기록 중 찍은 현장 사진도 다이어리에 합류 (id 중복 제거)
  const known = new Set(parsed.map((p) => p.id));
  for (const lp of livePhotosAsPhotoData()) {
    if (!known.has(lp.id)) parsed.push(lp);
  }
  return generateDiaryFromPhotoData(parsed);
}

async function generateDiaryFromPhotoData(parsed) {
  const photoData = parsed
    .map((photo) => {
      const estimated = estimatePhotoLocation(photo);
      if (estimated) {
        photo.lat = estimated.lat;
        photo.lng = estimated.lng;
        photo.locationSource = estimated.source;
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

  photoData.sort((a, b) => a.takenAt - b.takenAt);
  const photoById = new Map(photoData.map((photo) => [photo.id, photo]));
  const dateKeys = [...new Set(photoData.map((photo) => getLocalDateKey(photo.takenAt)).filter(Boolean))];
  const allowCrossDate = dateKeys.length > 1
    ? window.confirm('사진 날짜가 달라요. 같은 여행으로 이어서 묶을까요?')
    : false;
  const clusters = buildClusters(photoData, allowCrossDate);
  const targetClusters = clusters;
  const entries = [];
  const tripName = state.trip.title || '여행';

  for (let i = 0; i < targetClusters.length; i += 1) {
    const cluster = targetClusters[i];
    const firstPhoto = cluster.photos[0];
    const durationMinutes = Math.max(1, Math.round((cluster.lastTakenAt - cluster.firstTakenAt) / 60000));
    const timeLabel = formatRoundedTimeLabel(firstPhoto.takenAt);
    const fallbackPlace = `기록 스팟 ${i + 1}`;
    const place = await resolvePlaceName(cluster.center[0], cluster.center[1], fallbackPlace);
    const photoCount = cluster.photos.length;
    const selectedPhotos = selectRepresentativePhotos(cluster.photos);
    const photoUrls = selectedPhotos.map((photo) => photo.url || photo.dataUrl).filter(Boolean);
    entries.push({
      photoId: selectedPhotos[0]?.id || firstPhoto.id,
      photoIds: selectedPhotos.map((photo) => photo.id),
      time: timeLabel,
      dateLabel: `${formatMonthDay(firstPhoto.takenAt)} · ${tripName}`,
      place,
      note: makeDraftNote({ place, timestamp: firstPhoto.takenAt, durationMinutes, photoCount }),
      photoCount,
      photoUrls,
      center: cluster.center,
      timestamp: firstPhoto.takenAt,
      durationMinutes,
    });
  }

  entries.sort((a, b) => {
    const left = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const right = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return left - right;
  });

  state.generatedDiary = entries;
  state.diaryUnlocked = true;
  if (state.activeTrip) {
    state.activeTrip.status = 'completed';
    state.activeTrip.diary = entries;
    state.activeTrip.photos = photoData.map((photo) => ({
      id: photo.id,
      fileName: photo.fileName,
      dataUrl: photo.dataUrl,
      takenAt: photo.takenAt.toISOString(),
      lat: photo.lat,
      lng: photo.lng,
    }));
    upsertSavedTrip(state.activeTrip);
  }

  if (state.activeTrip) {
    renderTripOnMap(state.activeTrip);
  } else {
    focusMapOnPoints(entries.map((entry) => ({ lngLat: entry.center })));
  }

  // 다이어리 전체(장소 빈도·시간 범위)를 보고 자동 제목
  await suggestTitleFromEntries(entries);

  updateNavButtons();
  renderTripHistory();
  renderTimeline(entries);
  setScreen('diary');
  showToast('오늘의 여정이 다이어리로 정리되었습니다.');
}

function getEntryFeedbackIds(entry) {
  return [
    ...(Array.isArray(entry?.photoIds) ? entry.photoIds : []),
    entry?.photoId,
  ]
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String);
}

function syncDiaryDeletion(nextEntries, removedEntry) {
  const nextDiary = nextEntries.slice();
  getEntryFeedbackIds(removedEntry).forEach((photoId) => {
    state.acceptedPhotoIds.delete(photoId);
    state.rejectedPhotoIds.delete(photoId);
  });

  state.generatedDiary = nextDiary.length ? nextDiary : null;
  state.diaryUnlocked = nextDiary.length > 0;

  const feedback = {
    acceptedPhotoIds: Array.from(state.acceptedPhotoIds).map(String),
    rejectedPhotoIds: Array.from(state.rejectedPhotoIds).map(String),
  };
  const selectedTrip = getSelectedTrip({ fallback: false });
  const touched = new Set();
  [selectedTrip, state.activeTrip].forEach((trip) => {
    if (!trip || touched.has(trip.id)) return;
    trip.diary = nextDiary;
    trip.feedback = feedback;
    if (!nextDiary.length && trip.status === 'completed') {
      trip.status = 'recorded';
    }
    upsertSavedTrip(trip);
    touched.add(trip.id);
  });

  const mapTrip = state.activeTrip || selectedTrip;
  if (mapTrip && state.map) {
    renderTripOnMap(mapTrip);
  }
  return nextDiary;
}

function deleteDiaryEntry(index, entries) {
  if (!Array.isArray(entries) || entries === state.sampleTimeline) return null;
  const source = Array.isArray(state.generatedDiary) ? state.generatedDiary : entries;
  if (!source[index]) return null;
  const nextEntries = source.slice();
  const [removedEntry] = nextEntries.splice(index, 1);
  return syncDiaryDeletion(nextEntries, removedEntry);
}

function renderTimeline(entries = state.generatedDiary || state.sampleTimeline) {
  const isSampleTimeline = entries === state.sampleTimeline;
  elements.timeline.innerHTML = entries
    .map((entry, index) => {
      const photoUrls = Array.isArray(entry.photoUrls) ? entry.photoUrls.slice(0, REPRESENTATIVE_PHOTOS_PER_SPOT) : [];
      const place = escapeHtml(entry.place || '기록 스팟');
      const note = entry.note || '';
      const noteHtml = escapeHtml(note);
      const dateLabel = escapeHtml(entry.dateLabel || '');
      const timeLabel = escapeHtml(entry.time || '');
      const gallery = photoUrls.length
        ? `
          <div class="timeline-gallery timeline-gallery--${photoUrls.length}">
            ${photoUrls.map((url, photoIndex) => {
              const photoId = String(entry.photoIds?.[photoIndex] || entry.photoId || index);
              const approved = state.acceptedPhotoIds.has(photoId);
              const rejected = state.rejectedPhotoIds.has(photoId);
              const approveClass = approved ? ' is-sent is-sent-approve' : '';
              const rejectClass = rejected ? ' is-sent is-sent-reject' : '';
              const wrapClass = approved ? ' is-feedback-approved' : rejected ? ' is-feedback-rejected' : '';
              return `
              <div class="timeline-photo-wrap${wrapClass}" data-feedback-wrap="${escapeHtml(photoId)}">
                <img class="timeline-thumb" src="${escapeHtml(url)}" alt="${place} 사진 ${photoIndex + 1}" />
                <button class="photo-feedback-button photo-feedback-button--approve${approveClass}" type="button" data-feedback-photo="${escapeHtml(photoId)}" data-feedback-kind="approve" aria-pressed="${approved ? 'true' : 'false'}" aria-label="이 사진 좋아요">👍</button>
                <button class="photo-feedback-button photo-feedback-button--reject${rejectClass}" type="button" data-feedback-photo="${escapeHtml(photoId)}" data-feedback-kind="reject" aria-pressed="${rejected ? 'true' : 'false'}" aria-label="이 사진 별로예요">👎</button>
              </div>
            `; }).join('')}
          </div>
        `
        : '';
      return `
        <article class="timeline-entry">
          <div class="timeline-rail">
            <div class="timeline-dot"></div>
          </div>
          <div class="timeline-card">
            <div class="timeline-meta">
              <div class="timeline-time-stack">
                <p class="timeline-date">${dateLabel}</p>
                <p class="timeline-time">${timeLabel}</p>
              </div>
              <div class="timeline-actions-group">
                <button class="timeline-button" type="button" data-view-map="${index}">지도에서 보기</button>
                <button class="timeline-button timeline-button--edit" type="button" data-edit-note="${index}">수정</button>
                ${isSampleTimeline ? '' : `<button class="timeline-button timeline-button--danger" type="button" data-delete-entry="${index}">삭제</button>`}
              </div>
            </div>
            <h3 class="timeline-place">${place}</h3>
            <div class="timeline-photo-row">
              <p class="timeline-count">${entry.photoCount ? `사진 ${entry.photoCount}장` : ''}</p>
              <p class="timeline-count">${entry.durationMinutes ? `${entry.durationMinutes}분 기록` : ''}</p>
            </div>
            ${photoUrls.length >= 3 ? '<p class="timeline-note timeline-note--hint">대표 사진 3장을 골라 보여드려요.</p>' : ''}
            ${gallery}
            <div class="timeline-note-block" data-note-block="${index}">
              <div class="timeline-note-head">
                <span class="timeline-note-label">AI 메모 초안</span>
              </div>
              <p class="timeline-note" data-note-text="${index}">${noteHtml}</p>
              <p class="timeline-note-guide" data-note-guide="${index}">✎ 여기서 본 것과 느낀 점을 이어서 적어 보세요</p>
              <textarea class="timeline-note-input" data-note-input="${index}" maxlength="300" placeholder="여기서 본 것과 느낀 점을 이어서 적어 보세요" hidden>${noteHtml}</textarea>
              <div class="timeline-note-actions" data-note-actions="${index}" hidden>
                <button class="timeline-note-save" type="button" data-save-note="${index}">저장</button>
                <button class="timeline-note-cancel" type="button" data-cancel-note="${index}">취소</button>
              </div>
            </div>
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
      // 발자취·경로를 먼저 그린 뒤 해당 스팟으로 이동
      const trip = getSelectedTrip();
      if (trip) renderTripOnMap(trip);
      if (entry?.center && state.map) {
        centerMapOn(entry.center, 16.5);
      }
    });
  });

  elements.timeline.querySelectorAll('[data-edit-note]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.editNote);
      const input = elements.timeline.querySelector(`[data-note-input="${index}"]`);
      const text = elements.timeline.querySelector(`[data-note-text="${index}"]`);
      const actions = elements.timeline.querySelector(`[data-note-actions="${index}"]`);
      const guide = elements.timeline.querySelector(`[data-note-guide="${index}"]`);
      if (!input || !text || !actions) return;
      input.hidden = false;
      text.hidden = true;
      actions.hidden = false;
      if (guide) guide.hidden = true;
      button.hidden = true;
      // 수정 버튼은 카드 상단, 편집기는 하단이므로 편집기가 보이게 스크롤
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  // 피드(엔트리) 단위 삭제: 확인 후 해당 기록만 제거하고 지도·저장 동기화
  elements.timeline.querySelectorAll('[data-delete-entry]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.deleteEntry);
      const entry = entries[index];
      if (!entry) return;
      const placeName = (entry.place || '이 기록').split(',')[0];
      if (!window.confirm(`'${placeName}' 기록을 삭제하시겠습니까?`)) return;

      const nextEntries = deleteDiaryEntry(index, entries);
      if (!nextEntries) return;
      renderTimeline(nextEntries.length ? nextEntries : state.sampleTimeline);
      updateNavButtons();
      showToast('기록을 삭제했어요.');
    });
  });

  elements.timeline.querySelectorAll('[data-cancel-note]').forEach((button) => {
    button.addEventListener('click', () => {
      renderTimeline(entries);
    });
  });

  elements.timeline.querySelectorAll('[data-save-note]').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.saveNote);
      const input = elements.timeline.querySelector(`[data-note-input="${index}"]`);
      if (!input) return;
      button.disabled = true;
      const saved = await saveDiaryNote(index, input.value, entries);
      button.disabled = false;
      if (saved) renderTimeline(entries);
    });
  });

}

function syncCreateFields() {
  const stored = loadCreateFormState();
  elements.tripTitle.value = stored.title || '';
  elements.tripDate.value = stored.date || '';
  elements.tripRegion.value = stored.region || '';
  if (stored.date) {
    state.calendarSelectedDateKey = normalizeDateKey(stored.date);
  }
}

function saveCreateFormState() {
  if (!window.localStorage) return;
  const payload = {
    title: elements.tripTitle?.value || '',
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
  const nextDate = elements.tripDate.value;
  const existingSameDay = state.savedTrips.find((trip) => normalizeDateKey(trip.date) === normalizeDateKey(nextDate));
  cleanupGeneratedPhotoUrls();
  stopTracking();
  const trip = {
    id: existingSameDay?.id || (crypto.randomUUID ? crypto.randomUUID() : `trip_${Math.random().toString(16).slice(2)}`),
    title: nextTitle || '새 여행',
    date: nextDate,
    region: nextRegion || '미정 지역',
    createdAt: new Date().toISOString(),
    status: 'recording',
    recording: {
      startedAt: null,
      endedAt: null,
      elapsed: 0,
      samples: [],
      footprints: [],
      livePhotos: [],
    },
    diary: [],
    photos: [],
    feedback: {
      acceptedPhotoIds: [],
      rejectedPhotoIds: [],
    },
  };
  state.activeTripId = trip.id;
  state.activeTrip = trip;
  state.selectedTripId = trip.id;
  state.trip = {
    title: trip.title,
    date: trip.date,
    region: trip.region,
  };
  state.calendarSelectedDateKey = normalizeDateKey(trip.date);
  state.generatedDiary = null;
  state.diaryUnlocked = false;
  state.locationSamples = [];
  state.pendingLocationPoints = [];
  state.lastLocationSyncAt = 0;
  state.recordingStartedAt = null;
  state.recordingElapsed = 0;
  state.recordingBonusSeconds = 0;
  state.tripId = null;
  state.acceptedPhotoIds = new Set();
  state.rejectedPhotoIds = new Set();
  clearLiveMarkers();
  updateTripTexts();
  upsertSavedTrip(trip);
  renderTripHistory();
  renderTimeline();
  setScreen('map');
  setMapState('before');
  renderTripOnMap(trip);

  fetch(buildApiUrl('/api/trips'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: trip.title,
      start_date: trip.date,
      region: trip.region,
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
        flushLocationQueue({ force: true });
        showToast('여행이 서버에 생성되었어요. 이제 사진을 올릴 수 있어요.');
      }
    })
    .catch((error) => {
      console.error(error);
      showToast('여행 생성 API 연결은 실패했지만, 로컬 화면은 사용할 수 있어요.');
    });
}

function createDraftTripFromCurrentFields() {
  const trip = {
    id: crypto.randomUUID ? crypto.randomUUID() : `trip_${Math.random().toString(16).slice(2)}`,
    title: elements.tripTitle.value.trim() || state.trip.title || '새 여행',
    date: elements.tripDate.value || state.trip.date || formatLocalDate(new Date()),
    region: elements.tripRegion.value.trim() || state.trip.region || '미정 지역',
    createdAt: new Date().toISOString(),
    status: 'draft',
    recording: {
      startedAt: null,
      endedAt: null,
      elapsed: 0,
      samples: [],
      footprints: [],
      livePhotos: [],
    },
    diary: [],
    photos: [],
    feedback: {
      acceptedPhotoIds: [],
      rejectedPhotoIds: [],
    },
  };
  state.savedTrips.unshift(trip);
  state.savedTrips = dedupeTripsByDate(state.savedTrips);
  state.selectedTripId = trip.id;
  upsertSavedTrip(trip);
  return trip;
}

function ensureActiveTripForMap() {
  const selectedDateKey = getCalendarSelectedDateKey();
  let trip = getSelectedTrip({ fallback: false }) || getTripByDateKey(selectedDateKey);
  if (!trip) {
    trip = createDraftTripFromCurrentFields();
  }
  state.activeTripId = trip.id;
  state.activeTrip = trip;
  state.selectedTripId = trip.id;
  state.trip = {
    title: trip.title,
    date: trip.date,
    region: trip.region,
  };
  state.calendarSelectedDateKey = normalizeDateKey(trip.date);
  state.locationSamples = trip.recording?.samples ?? [];
  updateTripTexts();
  renderTripHistory();
  setMapState(getTripMapState(trip));
  return trip;
}

// 홈 화면 두 갈래: 실시간 기록 / 사진 업로드
function startRealtimeTrip() {
  createTrip();
  startRecording();
}

function startUploadTrip() {
  createTrip();
  elements.photoInput.value = '';
  elements.photoInput.click();
}

// 현재 위치 좌표 얻기 (최근 GPS 샘플 우선, 없으면 현재 마커)
function getCurrentLngLat() {
  const last = state.locationSamples[state.locationSamples.length - 1];
  if (last && Number.isFinite(last.lng) && Number.isFinite(last.lat)) {
    return [last.lng, last.lat];
  }
  if (state.currentMarker) {
    const p = state.currentMarker.getLngLat();
    return [p.lng, p.lat];
  }
  return null;
}

// 지도에 현장 사진 마커 추가
function addLivePhotoMarker(lngLat, dataUrl) {
  if (!state.map || !window.mapboxgl) return;
  const el = document.createElement('div');
  el.className = 'live-photo-marker';
  el.innerHTML = `<img src="${dataUrl}" alt="현장 사진" />`;
  const marker = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat(lngLat)
    .addTo(state.map);
  state.footprintMarkers.push(marker);
}

// 기록 중 현장 사진 촬영/앨범 추가 → 즉시 지도 반영
// 위치 우선순위: ① 사진 자체의 EXIF GPS(앨범 사진이 찍힌 곳) ② 촬영시각과 이동기록 보간 ③ 현재 위치
async function handleLivePhotoCapture(files) {
  let added = 0;
  const addedPoints = [];
  for (const file of files) {
    try {
      const photo = await parsePhotoFile(file);
      const estimated = estimatePhotoLocation(photo);
      // 현재 위치 폴백은 '방금 찍은 사진'(10분 이내)일 때만 허용.
      // 과거 앨범 사진은 자기 위치 정보가 없으면 현재 위치에 찍지 않는다.
      const isFresh =
        photo.takenAt instanceof Date &&
        Date.now() - photo.takenAt.getTime() < 10 * 60 * 1000;
      const lngLat = estimated
        ? [estimated.lng, estimated.lat]
        : isFresh ? getCurrentLngLat() : null;
      if (!lngLat) {
        showToast(`'${photo.fileName || '사진'}'에 위치 정보가 없어 지도에 표시하지 못했어요.`);
        continue;
      }
      addLivePhotoMarker(lngLat, photo.dataUrl);
      addedPoints.push({ lngLat });
      if (state.activeTrip) {
        state.activeTrip.recording.livePhotos = state.activeTrip.recording.livePhotos || [];
        state.activeTrip.recording.livePhotos.push({
          id: photo.id,
          fileName: photo.fileName,
          dataUrl: photo.dataUrl,
          lng: lngLat[0],
          lat: lngLat[1],
          takenAt: (photo.takenAt instanceof Date ? photo.takenAt : new Date()).toISOString(),
        });
        upsertSavedTrip(state.activeTrip);
      }
      added += 1;
    } catch (error) {
      console.error(error);
    }
  }
  if (added) {
    focusMapOnPoints(addedPoints);
    showToast(`현장 사진 ${added}장을 지도에 추가했어요`);
  }
}

function handleNav(target) {
  if (target === 'back') {
    const previous = state.previousScreen || 'create';
    setScreen(previous);
    if (previous === 'map') {
      setMapState(state.mapState);
    }
    return;
  }
  if (target === 'diary') {
    const trip = syncSelectedTripView();
    closeCalendar();
    setScreen('diary');
    renderTimeline(state.generatedDiary || state.sampleTimeline);
    if (trip && state.map && trip.id === state.selectedTripId) {
      renderTripOnMap(trip);
    }
    return;
  }
  if (target === 'diary' && !state.diaryUnlocked) return;
  let trip = target === 'diary' ? syncSelectedTripView() : null;
  closeCalendar();
  if (target === 'map') {
    trip = ensureActiveTripForMap();
  }
  setScreen(target);
  if (target === 'map') {
    if (trip) renderTripOnMap(trip);
  }
  if (target === 'diary') {
    renderTimeline(state.generatedDiary || state.sampleTimeline);
  }
}

function cleanupGeneratedPhotoUrls() {
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
  if (!photoId) return;
  // 로컬 선호는 서버 연결과 무관하게 항상 저장
  if (kind === 'approve') {
    state.acceptedPhotoIds.add(photoId);
    state.rejectedPhotoIds.delete(photoId);
  } else {
    state.rejectedPhotoIds.add(photoId);
    state.acceptedPhotoIds.delete(photoId);
  }
  persistPhotoFeedbackLocally();
  if (!state.tripId) return;
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

function persistPhotoFeedbackLocally() {
  const feedback = {
    acceptedPhotoIds: Array.from(state.acceptedPhotoIds).map(String),
    rejectedPhotoIds: Array.from(state.rejectedPhotoIds).map(String),
  };
  const selectedTrip = getSelectedTrip({ fallback: false });
  if (selectedTrip) {
    selectedTrip.feedback = feedback;
    upsertSavedTrip(selectedTrip);
  }
  if (state.activeTrip) {
    state.activeTrip.feedback = feedback;
    upsertSavedTrip(state.activeTrip);
  }
}

function persistDiaryNoteLocally(entryIndex, note, entries) {
  if (Array.isArray(entries) && entries[entryIndex]) {
    entries[entryIndex].note = note;
  }
  if (Array.isArray(state.generatedDiary) && state.generatedDiary[entryIndex]) {
    state.generatedDiary[entryIndex].note = note;
  }

  const selectedTrip = getSelectedTrip({ fallback: false });
  if (selectedTrip?.diary?.[entryIndex]) {
    selectedTrip.diary[entryIndex].note = note;
    upsertSavedTrip(selectedTrip);
  }
  if (state.activeTrip?.diary?.[entryIndex]) {
    state.activeTrip.diary[entryIndex].note = note;
    upsertSavedTrip(state.activeTrip);
  }
}

async function persistDiaryNoteToApi(entryIndex, note) {
  if (!state.tripId) return null;
  const response = await fetch(buildApiUrl(`/api/trips/${state.tripId}/diary/notes/${entryIndex}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  });
  if (!response.ok) {
    throw new Error(`Diary note update failed: ${response.status}`);
  }
  return response.json();
}

async function saveDiaryNote(entryIndex, note, entries) {
  const nextNote = note.trim();
  if (!nextNote) {
    showToast('메모는 비워둘 수 없어요.');
    return false;
  }
  if (nextNote.length > 300) {
    showToast('메모는 300자 이내로 작성해 주세요.');
    return false;
  }

  persistDiaryNoteLocally(entryIndex, nextNote, entries);
  try {
    await persistDiaryNoteToApi(entryIndex, nextNote);
    showToast('메모를 저장했어요.');
  } catch (error) {
    console.warn(error);
    showToast('메모를 이 기기에 저장했어요.');
  }
  return true;
}

function bootstrap() {
  const loadedTrips = readSavedTrips();
  state.savedTrips = dedupeTripsByDate(loadedTrips);
  if (loadedTrips.length !== state.savedTrips.length) {
    writeSavedTrips();
  }
  state.selectedTripId = state.savedTrips[0]?.id || null;
  syncCreateFields();
  syncSelectedTripView();
  readSavedTripsFromIndexedDb().then((indexedTrips) => {
    if (!indexedTrips.length) return;
    const selectedId = state.selectedTripId;
    state.savedTrips = dedupeTripsByDate([...indexedTrips, ...state.savedTrips]);
    state.selectedTripId = selectedId && state.savedTrips.some((trip) => trip.id === selectedId)
      ? selectedId
      : state.savedTrips[0]?.id || null;
    syncSelectedTripView();
    if (state.screen === 'map') {
      const trip = ensureActiveTripForMap();
      renderTripOnMap(trip);
    }
    if (state.calendarOpen) renderCalendar();
  });
  if (!state.savedTrips.length) {
    renderTimeline(state.sampleTimeline);
  }
  setScreen('create');
  setMapState('before');
  updateRecordingTimer();

  elements.createForm.addEventListener('submit', (event) => {
    event.preventDefault();
    startRealtimeTrip();
  });
  elements.createTripButton.addEventListener('click', startRealtimeTrip);
  elements.createUploadButton?.addEventListener('click', startUploadTrip);
  elements.createDiaryButton?.addEventListener('click', () => handleNav('diary'));
  elements.createPhotoImportButton?.addEventListener('click', () => {
    elements.photoInput.value = '';
    elements.photoInput.click();
  });
  elements.livePhotoButton?.addEventListener('click', () => {
    elements.livePhotoInput.value = '';
    elements.livePhotoInput.click();
  });
  elements.livePhotoInput?.addEventListener('change', async () => {
    const files = Array.from(elements.livePhotoInput.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length) await handleLivePhotoCapture(files);
  });
  elements.tripTitle.addEventListener('input', saveCreateFormState);
  elements.tripDate.addEventListener('input', () => {
    state.calendarSelectedDateKey = normalizeDateKey(elements.tripDate.value);
    state.trip.date = elements.tripDate.value;
    saveCreateFormState();
  });
  elements.tripRegion.addEventListener('input', saveCreateFormState);
  elements.startRecording.addEventListener('click', startRecording);
  elements.endRecording.addEventListener('click', endRecording);
  elements.photoImportButton.addEventListener('click', () => {
    elements.photoInput.value = '';
    elements.photoInput.click();
  });
  if (elements.calendarToggle) {
    elements.calendarToggle.addEventListener('click', openCalendar);
  }
  if (elements.diaryCalendarToggle) {
    elements.diaryCalendarToggle.addEventListener('click', openCalendar);
  }
  if (elements.calendarClose) {
    elements.calendarClose.addEventListener('click', closeCalendar);
  }
  if (elements.calendarPrev) {
    elements.calendarPrev.addEventListener('click', () => moveCalendarMonth(-1));
  }
  if (elements.calendarNext) {
    elements.calendarNext.addEventListener('click', () => moveCalendarMonth(1));
  }
  elements.calendarModal?.querySelectorAll('[data-calendar-close]').forEach((button) => {
    button.addEventListener('click', closeCalendar);
  });
  elements.photoInput.addEventListener('change', async () => {
    const files = Array.from(elements.photoInput.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    try {
      await uploadPhotosToApi(files);
      // 1순위: 백엔드 AI 선별 파이프라인. 실패하면 클라이언트 처리로 폴백.
      const usedBackend = await generateDiaryFromBackend();
      if (!usedBackend) {
        await generateDiaryFromFiles(files);
      }
    } catch (error) {
      console.error(error);
      setUploadProgress('', false);
      try {
        await generateDiaryFromFiles(files);
      } catch (fallbackError) {
        console.error(fallbackError);
        showToast('사진 업로드 또는 처리 중 오류가 발생했어요.');
      }
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

    // ① 즉시 시각 반응 (서버 결과와 무관하게): 버튼 색·팝 + 사진 중앙 이모지 버스트
    button.classList.remove('is-sent', 'is-sent-approve', 'is-sent-reject');
    // 반대 버튼의 선택 상태는 해제
    const wrap = button.closest('.timeline-photo-wrap');
    if (wrap) {
      wrap.querySelectorAll('.photo-feedback-button').forEach((b) => {
        if (b !== button) b.classList.remove('is-sent', 'is-sent-approve', 'is-sent-reject');
        if (b !== button) b.setAttribute('aria-pressed', 'false');
      });
      wrap.classList.remove('is-feedback-approved', 'is-feedback-rejected');
      wrap.classList.add(kind === 'approve' ? 'is-feedback-approved' : 'is-feedback-rejected');
      const burst = document.createElement('span');
      burst.className = 'feedback-burst';
      burst.textContent = kind === 'approve' ? '👍' : '👎';
      wrap.appendChild(burst);
      burst.addEventListener('animationend', () => burst.remove());
    }
    // reflow 후 클래스 부여 (연속 클릭에도 팝 애니메이션 재생)
    void button.offsetWidth;
    button.classList.add('is-sent', kind === 'approve' ? 'is-sent-approve' : 'is-sent-reject');
    button.setAttribute('aria-pressed', 'true');

    // ② 저장은 백그라운드: 로컬 상태는 항상 반영, 서버 전송 실패는 조용히 넘어감
    try {
      await submitPhotoFeedback(photoId, kind);
    } catch (error) {
      console.warn('피드백 서버 전송 실패(로컬에는 반영됨):', error);
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
  if (elements.memoryVideoButton) {
    elements.memoryVideoButton.addEventListener('click', () => {
      createMemoryVideo();
    });
  }
  if (elements.deleteDiaryButton) {
    elements.deleteDiaryButton.addEventListener('click', () => {
      const confirmed = window.confirm('다이어리 전체를 삭제하시겠습니까? 이 여행의 모든 기록이 지워집니다.');
      if (!confirmed) return;
      cleanupGeneratedPhotoUrls();
      state.generatedDiary = null;
      state.diaryUnlocked = false;
      state.tripId = null;
      clearLastTripId();
      state.acceptedPhotoIds = new Set();
      state.rejectedPhotoIds = new Set();
      renderTimeline();
      updateNavButtons();
      setScreen('create');
      showToast('다이어리를 삭제했어요');
    });
  }

  syncServerTrips()
    .catch((error) => {
      console.warn('failed to sync server trips', error);
    })
    .finally(() => {
      restoreLastTrip().catch((error) => {
        console.error(error);
      });
    });
}

// ============================================================
// 추억 영상 만들기: 발자취 경로 위를 걸으며 사진이 순서대로 나오는
// 세로형 영상을 캔버스로 그려 MediaRecorder 로 녹화 → 다운로드.
// ============================================================

const MEMORY_VIDEO_FORMATS = [
  { mime: 'video/webm;codecs=vp9,opus', label: 'WEBM' },
  { mime: 'video/webm;codecs=vp8,opus', label: 'WEBM' },
  { mime: 'video/webm', label: 'WEBM' },
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', label: 'MP4' },
  { mime: 'video/mp4;codecs=h264,aac', label: 'MP4' },
  { mime: 'video/mp4', label: 'MP4' },
];

function pickVideoFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MEMORY_VIDEO_FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mime))
    || { mime: '', label: '기본 영상' };
}

function getVideoExtension(mime) {
  const normalized = (mime || '').toLowerCase();
  if (normalized.includes('mp4')) return 'mp4';
  return 'webm';
}

function getVideoLabel(mime) {
  return getVideoExtension(mime).toUpperCase();
}

function getVideoBaseMime(mime) {
  return getVideoExtension(mime) === 'mp4' ? 'video/mp4' : 'video/webm';
}

function downloadMemoryVideo(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getVideoSaveTypes(mime) {
  const ext = getVideoExtension(mime);
  const type = getVideoBaseMime(mime);
  return [{
    description: `${ext.toUpperCase()} 영상`,
    accept: { [type]: [`.${ext}`] },
  }];
}

async function saveMemoryVideo(blob, fileName, mime) {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: getVideoSaveTypes(mime),
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      console.warn('failed to save video with file picker', error);
    }
  }

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (typeof File !== 'undefined' && nav?.share && nav?.canShare) {
    try {
      const file = new File([blob], fileName, { type: getVideoBaseMime(mime || blob.type) });
      if (nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Travel Diary 추억 영상',
          text: '오늘의 발자취 영상이에요.',
        });
        return 'shared';
      }
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      console.warn('failed to share video file', error);
    }
  }

  downloadMemoryVideo(blob, fileName);
  return 'downloaded';
}

function loadImageForCanvas(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCoverImage(ctx, img, x, y, w, h, zoom = 1) {
  if (!img) return;
  const ratio = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

// ---------- 이징 ----------
function easeOutBack(t) {
  const c1 = 1.70158; const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInExpo(t) { return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// 시드 기반 의사난수 (프레임마다 같은 별/얼룩 위치 유지)
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function getMemoryText(entries) {
  return [
    state.trip.title,
    state.trip.region,
    ...entries.map((entry) => `${entry.place || ''} ${entry.note || ''}`),
  ].join(' ').toLowerCase();
}

function pickMusicProfile(entries) {
  const text = getMemoryText(entries);
  if (/일본|도쿄|교토|오사카|후쿠오카|삿포로|okinawa|japan|tokyo|kyoto|osaka|fukuoka|sapporo/.test(text)) {
    return {
      name: '동아시아 여행 무드',
      master: 0.68,
      barDur: 2.45,
      chords: [
        [293.66, 369.99, 440.0, 587.33],
        [246.94, 329.63, 392.0, 493.88],
        [220.0, 293.66, 369.99, 440.0],
        [261.63, 329.63, 392.0, 523.25],
      ],
      melody: [0, 2, 4, 2, 1, 2, 4, 5],
      scale: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33],
      padType: 'triangle',
      leadType: 'sine',
      texture: 'bell',
    };
  }
  if (/바다|해변|섬|제주|오키나와|하와이|발리|푸켓|코타키나발루|beach|island|bali|hawaii|phuket|sea|ocean/.test(text)) {
    return {
      name: '바다 여행 무드',
      master: 0.7,
      barDur: 2.65,
      chords: [
        [246.94, 329.63, 415.3, 554.37],
        [277.18, 349.23, 440.0, 554.37],
        [220.0, 277.18, 369.99, 440.0],
        [207.65, 311.13, 392.0, 493.88],
      ],
      melody: [0, 3, 4, 6, 4, 3, 1, 3],
      scale: [246.94, 277.18, 329.63, 369.99, 415.3, 493.88, 554.37],
      padType: 'sine',
      leadType: 'triangle',
      texture: 'wave',
    };
  }
  if (/프랑스|파리|이탈리아|로마|스페인|바르셀로나|런던|유럽|paris|france|italy|rome|spain|barcelona|london|europe/.test(text)) {
    return {
      name: '유럽 산책 무드',
      master: 0.64,
      barDur: 2.85,
      chords: [
        [261.63, 329.63, 392.0, 523.25],
        [196.0, 246.94, 329.63, 392.0],
        [220.0, 261.63, 349.23, 440.0],
        [174.61, 261.63, 329.63, 392.0],
      ],
      melody: [2, 4, 5, 7, 5, 4, 2, 1],
      scale: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
      padType: 'triangle',
      leadType: 'sine',
      texture: 'waltz',
    };
  }
  if (/밤|야경|시티|도시|서울|홍콩|뉴욕|night|city|seoul|hong kong|new york|nyc/.test(text)) {
    return {
      name: '도시 야경 무드',
      master: 0.66,
      barDur: 2.35,
      chords: [
        [220.0, 277.18, 329.63, 440.0],
        [196.0, 246.94, 293.66, 392.0],
        [174.61, 220.0, 261.63, 349.23],
        [207.65, 261.63, 311.13, 415.3],
      ],
      melody: [0, 2, 4, 6, 4, 2, 1, 2],
      scale: [174.61, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0],
      padType: 'sawtooth',
      leadType: 'sine',
      texture: 'pulse',
    };
  }
  return {
    name: '따뜻한 여행 무드',
    master: 0.66,
    barDur: 2.75,
    chords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 349.23],
    ],
    melody: [0, 2, 4, 2, 3, 5, 4, 2],
    scale: [196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 392.0],
    padType: 'triangle',
    leadType: 'sine',
    texture: 'lofi',
  };
}

// ---------- 배경음악: WebAudio 로 직접 합성한 저작권 프리 여행 무드 ----------
function buildMemoryTrack(audioCtx, destination, totalSec, profile = pickMusicProfile([])) {
  const master = audioCtx.createGain();
  master.gain.value = 0.0001;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.18;
  const warm = audioCtx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = profile.texture === 'pulse' ? 2100 : 1700;
  master.connect(compressor);
  compressor.connect(warm);
  warm.connect(destination);

  const t0 = audioCtx.currentTime + 0.05;
  // 페이드 인/아웃
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(profile.master, t0 + 0.8);
  master.gain.setValueAtTime(profile.master, t0 + Math.max(1.3, totalSec - 1.4));
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + totalSec);

  const { chords, scale, melody } = profile;
  const barDur = profile.barDur;
  const bars = Math.ceil(totalSec / barDur) + 1;

  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chords[bar % chords.length];
    const barStart = t0 + bar * barDur;

    // 패드 (따뜻한 삼각파, 느린 어택)
    chord.forEach((freq, vi) => {
      const osc = audioCtx.createOscillator();
      osc.type = profile.padType;
      osc.frequency.value = freq;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, barStart);
      g.gain.exponentialRampToValueAtTime(vi === 0 ? 0.055 : 0.04, barStart + 0.5);
      g.gain.setValueAtTime(0.04, barStart + barDur - 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, barStart + barDur + 0.2);
      osc.connect(g); g.connect(master);
      osc.start(barStart); osc.stop(barStart + barDur + 0.3);
    });

    // 아르페지오 플럭 (한 옥타브 위, 8분음)
    for (let step = 0; step < 8; step += 1) {
      if (step % 4 === 3) continue; // 살짝 쉼표로 여유
      const noteStart = barStart + (step * barDur) / 8;
      const freq = scale[melody[(bar * 3 + step) % melody.length] % scale.length] * (step > 4 ? 1.5 : 1);
      const osc = audioCtx.createOscillator();
      osc.type = profile.leadType;
      osc.frequency.value = freq;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, noteStart);
      g.gain.exponentialRampToValueAtTime(profile.texture === 'bell' ? 0.075 : 0.055, noteStart + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, noteStart + (profile.texture === 'waltz' ? 0.55 : 0.36));
      osc.connect(g); g.connect(master);
      osc.start(noteStart); osc.stop(noteStart + 0.65);
    }

    // 소프트 킥 (바 시작, 낮게 툭)
    const kick = audioCtx.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(105, barStart);
    kick.frequency.exponentialRampToValueAtTime(42, barStart + 0.12);
    const kg = audioCtx.createGain();
    kg.gain.setValueAtTime(0.11, barStart);
    kg.gain.exponentialRampToValueAtTime(0.0001, barStart + 0.22);
    kick.connect(kg); kg.connect(master);
    kick.start(barStart); kick.stop(barStart + 0.3);

    if (profile.texture === 'wave' || profile.texture === 'pulse') {
      for (let step = 2; step < 8; step += 4) {
        const hitStart = barStart + (step * barDur) / 8;
        const hat = audioCtx.createBufferSource();
        const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.12), audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        hat.buffer = buf;
        const hf = audioCtx.createBiquadFilter();
        hf.type = 'highpass'; hf.frequency.value = profile.texture === 'pulse' ? 5200 : 2600;
        const hg = audioCtx.createGain();
        hg.gain.setValueAtTime(profile.texture === 'pulse' ? 0.045 : 0.03, hitStart);
        hg.gain.exponentialRampToValueAtTime(0.0001, hitStart + 0.12);
        hat.connect(hf); hf.connect(hg); hg.connect(master);
        hat.start(hitStart); hat.stop(hitStart + 0.14);
      }
    }
  }

  // 질감: 비닐/바람/공기 노이즈를 아주 작게 깔아 무음처럼 느껴지지 않게 한다.
  const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i += 1) nd[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuf; noise.loop = true;
  const nf = audioCtx.createBiquadFilter();
  nf.type = profile.texture === 'wave' ? 'bandpass' : 'lowpass';
  nf.frequency.value = profile.texture === 'wave' ? 700 : 900;
  const ng = audioCtx.createGain(); ng.gain.value = profile.texture === 'wave' ? 0.02 : 0.012;
  noise.connect(nf); nf.connect(ng); ng.connect(master);
  noise.start(t0); noise.stop(t0 + totalSec);

  return profile;
}

// ---------- 지구본 씬 ----------
function drawGlobeScene(ctx, W, H, p, pinLabel) {
  // 우주 배경
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0f24');
  bg.addColorStop(1, '#1c2447');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 별 (시드 고정 + 반짝임)
  const rand = seededRand(77);
  for (let i = 0; i < 130; i += 1) {
    const x = rand() * W; const y = rand() * H;
    const size = 0.6 + rand() * 1.8;
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(p * 12 + i));
    ctx.fillStyle = `rgba(255,255,255,${0.35 * tw})`;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }

  const cx = W / 2; const cy = 560; const R = 250;
  const rot = p * 2.2; // 지구 자전
  // 핀의 구면 위치 (자전에 따라 이동, 후반에 정면에 옴)
  const pinAngle = 1.15 - rot; // 라디안
  const pinX = cx + Math.sin(pinAngle) * R * 0.62;
  const pinY = cy - R * 0.28;
  const pinVisible = Math.cos(pinAngle) > -0.15;

  // 줌: 마지막 28% 동안 핀으로 급확대
  const zp = p < 0.72 ? 0 : easeInExpo((p - 0.72) / 0.28);
  const scale = 1 + zp * 22;
  ctx.save();
  ctx.translate(pinX, pinY);
  ctx.scale(scale, scale);
  ctx.translate(-pinX, -pinY);

  // 대기 글로우
  const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
  glow.addColorStop(0, 'rgba(96,150,255,0.32)');
  glow.addColorStop(1, 'rgba(96,150,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.fill();

  // 구 본체
  const sphere = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R);
  sphere.addColorStop(0, '#5f8fe8');
  sphere.addColorStop(0.55, '#2c5cc4');
  sphere.addColorStop(1, '#122b6e');
  ctx.fillStyle = sphere;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 구 안쪽 클립
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

  // 대륙 느낌 얼룩 (자전에 따라 흐름)
  const landRand = seededRand(42);
  ctx.fillStyle = 'rgba(126, 217, 154, 0.5)';
  for (let i = 0; i < 9; i += 1) {
    const baseA = landRand() * Math.PI * 2;
    const bandY = cy + (landRand() - 0.5) * R * 1.4;
    const a = baseA + rot;
    const lx = cx + Math.sin(a) * R * 0.9;
    const depth = Math.cos(a); // 뒤로 돌아가면 안 보임
    if (depth < 0.05) continue;
    const w = (40 + landRand() * 95) * depth;
    const h2 = 30 + landRand() * 70;
    ctx.beginPath();
    ctx.ellipse(lx, bandY, w, h2, landRand() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 경선 그리드 (회전)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI + rot;
    const rx = Math.abs(Math.cos(a)) * R;
    if (rx < 2) continue;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // 위선
  for (let i = 1; i < 5; i += 1) {
    const yy = cy - R + (i / 5) * 2 * R;
    const rx = Math.sqrt(Math.max(0, R * R - (yy - cy) * (yy - cy)));
    ctx.beginPath(); ctx.ellipse(cx, yy, rx, rx * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // 핀 + 펄스 링
  if (pinVisible) {
    const pulse = 10 + 7 * Math.abs(Math.sin(p * 9));
    ctx.strokeStyle = 'rgba(255,120,90,0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pinX, pinY, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '38px serif';
    ctx.textAlign = 'center';
    ctx.fillText('📍', pinX, pinY + 4);
  }
  ctx.restore();

  // 타이틀 텍스트 (줌 전까지)
  if (zp < 0.4) {
    ctx.globalAlpha = 1 - zp / 0.4;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.textAlign = 'center';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText(pinLabel || '여행의 기억', W / 2, 175);
    ctx.font = '500 24px "Noto Sans KR", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('그날의 발자취를 따라', W / 2, 218);
    ctx.globalAlpha = 1;
  }

  // 줌 마지막: 화이트 플래시로 전환
  if (zp > 0.75) {
    ctx.fillStyle = `rgba(253,246,238,${(zp - 0.75) / 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------- 추억 영상 메인 ----------
async function createMemoryVideo() {
  const entries = (state.generatedDiary || []).filter((e) => Array.isArray(e.center));
  if (!entries.length) {
    showToast('먼저 사진으로 다이어리를 만들어 주세요.');
    return;
  }
  const format = pickVideoFormat();
  if (!format || !HTMLCanvasElement.prototype.captureStream) {
    showToast('이 브라우저는 영상 만들기를 지원하지 않아요.');
    return;
  }
  if (!window.confirm('추억 영상을 만들어 저장할까요? (배경음악 포함 · 15초 정도 걸려요)')) return;

  const button = elements.memoryVideoButton;
  if (button) { button.disabled = true; button.textContent = '🎬 만드는 중…'; }
  showToast('영상을 만드는 중이에요… 화면을 그대로 두세요');

  let audioCtx = null;
  try {
    const images = await Promise.all(
      entries.map((e) => loadImageForCanvas(e.mainPhoto || (e.photoUrls && e.photoUrls[0]) || '')),
    );

    const trip = getSelectedTrip();
    const samples = trip?.recording?.samples || [];
    const rawPath = samples.length >= 2
      ? samples.map((s) => [s.lng, s.lat])
      : entries.map((e) => e.center);

    const W = 720; const H = 1280;
    const mapArea = { x: 70, y: 900, w: W - 140, h: 280 };
    const lngs = rawPath.map((pt) => pt[0]);
    const lats = rawPath.map((pt) => pt[1]);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const spanLng = Math.max(maxLng - minLng, 1e-6);
    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const toXY = ([lng, lat]) => [
      mapArea.x + ((lng - minLng) / spanLng) * mapArea.w,
      mapArea.y + (1 - (lat - minLat) / spanLat) * mapArea.h,
    ];
    const path = rawPath.map(toXY);
    const spotXY = entries.map((e) => toXY(e.center));

    // 타임라인: 지구본 → (사진 fly-in → 감상 → 수납)*n → 아웃트로
    const GLOBE = 3200; const FLY = 750; const HOLD = 2200; const TUCK = 380; const OUTRO = 3000;
    const segs = [{ type: 'globe', dur: GLOBE }];
    entries.forEach((_, i) => {
      segs.push({ type: 'fly', dur: FLY, idx: i });
      segs.push({ type: 'hold', dur: HOLD, idx: i });
      segs.push({ type: 'tuck', dur: TUCK, idx: i });
    });
    segs.push({ type: 'outro', dur: OUTRO });
    const total = segs.reduce((a, s) => a + s.dur, 0);

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 영상 + 오디오 트랙 합성
    const videoStream = canvas.captureStream(30);
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();
    const audioDest = audioCtx.createMediaStreamDestination();
    const musicProfile = pickMusicProfile(entries);
    buildMemoryTrack(audioCtx, audioDest, total / 1000 + 0.3, musicProfile);
    const audioTracks = audioDest.stream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn('memory video audio track was not created');
    }
    const mixed = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const recorderOptions = {
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    };
    if (format.mime) recorderOptions.mimeType = format.mime;
    const recorder = new MediaRecorder(mixed, recorderOptions);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();

    const title = state.trip.title || '여행 다이어리';
    const dateText = state.trip.date ? formatDateLabel(state.trip.date) : '';
    const spotT = entries.map((_, i) => (entries.length === 1 ? 1 : i / (entries.length - 1)));

    const pathPointAt = (t) => {
      if (path.length === 1) return path[0];
      const f = Math.max(0, Math.min(1, t)) * (path.length - 1);
      const i = Math.min(Math.floor(f), path.length - 2);
      const r = f - i;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * r, path[i][1] + (path[i + 1][1] - path[i][1]) * r];
    };

    // 폴라로이드 카드 (fly-in 보간용 파라미터로 그리기)
    const CARD = { w: 560, h: 560, x: (W - 560) / 2, y: 250 };
    const drawPolaroid = (idx, k, alpha, kenburns) => {
      const e = entries[idx];
      const img = images[idx];
      const [sx, sy] = spotXY[idx];
      // k: 0(스팟 위 점) → 1(중앙 카드)
      const cw = 40 + (CARD.w - 40) * k;
      const chh = 40 + (CARD.h - 40) * k;
      const cx0 = sx + (CARD.x - sx) * k;
      const cy0 = sy + (CARD.y - sy) * k;
      const rot = (idx % 2 === 0 ? -1 : 1) * 0.025 * k;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(cx0 + cw / 2, cy0 + chh / 2);
      ctx.rotate(rot);
      ctx.translate(-(cx0 + cw / 2), -(cy0 + chh / 2));
      ctx.shadowColor = 'rgba(70,45,30,0.32)'; ctx.shadowBlur = 26 * k; ctx.shadowOffsetY = 10 * k;
      ctx.fillStyle = '#fffdf9';
      drawRoundedRect(ctx, cx0, cy0, cw, chh + 84 * k, 18); ctx.fill();
      ctx.shadowColor = 'transparent';
      const pad = 16 * k + 4;
      if (img) {
        const zoom = 1 + 0.06 * kenburns;
        const iw0 = cw - pad * 2; const ih0 = chh - pad * 2;
        const ratio = Math.max(iw0 / img.width, ih0 / img.height) * zoom;
        const iw = img.width * ratio; const ih = img.height * ratio;
        ctx.save();
        drawRoundedRect(ctx, cx0 + pad, cy0 + pad, iw0, ih0, 12); ctx.clip();
        ctx.drawImage(img, cx0 + pad + (iw0 - iw) / 2, cy0 + pad + (ih0 - ih) / 2, iw, ih);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f0e3d6';
        drawRoundedRect(ctx, cx0 + pad, cy0 + pad, cw - pad * 2, chh - pad * 2, 12); ctx.fill();
      }
      if (k > 0.85) {
        const capA = (k - 0.85) / 0.15;
        ctx.globalAlpha = Math.min(alpha, capA);
        ctx.fillStyle = '#43312c'; ctx.textAlign = 'center';
        ctx.font = '700 30px "Noto Sans KR", sans-serif';
        ctx.fillText((e.place || '').split(',')[0], W / 2, cy0 + chh + 40);
        ctx.fillStyle = '#8a7364'; ctx.font = '500 23px "Noto Sans KR", sans-serif';
        ctx.fillText(e.time || '', W / 2, cy0 + chh + 72);
      }
      ctx.restore();
    };

    const drawMapScene = (walkT, extra, moodImage = null) => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#fdf6ee');
      grad.addColorStop(1, '#f3e2d0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      if (moodImage) {
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.filter = 'blur(18px) saturate(1.18)';
        drawCoverImage(ctx, moodImage, -36, -36, W + 72, H + 72, 1.08);
        ctx.restore();
        const veil = ctx.createLinearGradient(0, 0, 0, H);
        veil.addColorStop(0, 'rgba(253,246,238,0.78)');
        veil.addColorStop(0.42, 'rgba(253,246,238,0.56)');
        veil.addColorStop(1, 'rgba(243,226,208,0.82)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.fillStyle = '#43312c'; ctx.textAlign = 'center';
      ctx.font = '700 42px Georgia, serif';
      ctx.fillText(title, W / 2, 105);
      if (dateText) {
        ctx.font = '500 24px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#8a7364';
        ctx.fillText(dateText, W / 2, 148);
      }

      // 경로 글로우 + 전체 경로 + 진행 경로
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(160,120,95,0.25)'; ctx.lineWidth = 6;
      ctx.beginPath();
      path.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
      ctx.stroke();

      const upto = Math.max(2, Math.ceil(walkT * (path.length - 1)) + 1);
      ctx.save();
      ctx.shadowColor = 'rgba(200,111,79,0.8)'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#c86f4f'; ctx.lineWidth = 7;
      ctx.beginPath();
      path.slice(0, upto).forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
      ctx.stroke();
      ctx.restore();

      spotXY.forEach((pt, i) => {
        ctx.fillStyle = spotT[i] <= walkT + 1e-6 ? '#c86f4f' : 'rgba(160,120,95,0.4)';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill();
      });

      const cur = pathPointAt(walkT);
      ctx.font = '34px serif';
      ctx.fillText('🐾', cur[0], cur[1] - 12);

      if (extra) extra();
    };

    const drawFrame = (elapsed) => {
      let acc = 0; let seg = segs[segs.length - 1]; let segElapsed = 0;
      for (const s of segs) {
        if (elapsed < acc + s.dur) { seg = s; segElapsed = elapsed - acc; break; }
        acc += s.dur;
      }
      const p = Math.min(1, segElapsed / seg.dur);

      if (seg.type === 'globe') {
        drawGlobeScene(ctx, W, H, p, title);
        return;
      }

      // 현재 경로 진행률
      let walkT = 0;
      if (seg.type === 'fly') {
        const from = seg.idx === 0 ? 0 : spotT[seg.idx - 1];
        walkT = from + (spotT[seg.idx] - from) * easeInOutQuad(p);
      } else if (seg.type === 'hold' || seg.type === 'tuck') walkT = spotT[seg.idx];
      else walkT = 1;

      if (seg.type === 'fly') {
        drawMapScene(walkT, () => {
          drawPolaroid(seg.idx, easeOutBack(p), Math.min(1, p * 2), 0);
        }, images[seg.idx]);
      } else if (seg.type === 'hold') {
        drawMapScene(walkT, () => {
          drawPolaroid(seg.idx, 1, 1, p);
        }, images[seg.idx]);
      } else if (seg.type === 'tuck') {
        drawMapScene(walkT, () => {
          drawPolaroid(seg.idx, 1 - easeInOutQuad(p) * 0.9, 1 - p, 1);
        }, images[seg.idx]);
      } else if (seg.type === 'outro') {
        drawMapScene(1, () => {
          // 폴라로이드 콜라주 부채꼴
          const n = entries.length;
          const shown = Math.ceil(easeInOutQuad(Math.min(1, p * 1.4)) * n);
          const baseY = 420;
          for (let i = 0; i < shown; i += 1) {
            const img = images[i];
            const spread = n === 1 ? 0 : (i / (n - 1) - 0.5);
            const ang = spread * 0.5;
            const px = W / 2 + spread * 300;
            const py = baseY + Math.abs(spread) * 55;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(ang * 0.55);
            ctx.shadowColor = 'rgba(70,45,30,0.28)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
            ctx.fillStyle = '#fffdf9';
            drawRoundedRect(ctx, -78, -78, 156, 186, 12); ctx.fill();
            ctx.shadowColor = 'transparent';
            if (img) {
              const ratio = Math.max(136 / img.width, 136 / img.height);
              const iw = img.width * ratio; const ih = img.height * ratio;
              ctx.save();
              drawRoundedRect(ctx, -68, -68, 136, 136, 8); ctx.clip();
              ctx.drawImage(img, -iw / 2, -68 + (136 - ih) / 2, iw, ih);
              ctx.restore();
            } else {
              ctx.fillStyle = '#f0e3d6';
              drawRoundedRect(ctx, -68, -68, 136, 136, 8); ctx.fill();
            }
            ctx.restore();
          }
          if (p > 0.35) {
            ctx.globalAlpha = Math.min(1, (p - 0.35) / 0.3);
            ctx.fillStyle = '#43312c'; ctx.textAlign = 'center';
            ctx.font = '600 30px "Noto Sans KR", sans-serif';
            ctx.fillText('— 오늘의 여정 끝 —', W / 2, 720);
            ctx.font = '500 24px "Noto Sans KR", sans-serif';
            ctx.fillStyle = '#8a7364';
            ctx.fillText(`${entries.length}곳의 기억 · Travel Diary`, W / 2, 762);
            ctx.font = '500 20px "Noto Sans KR", sans-serif';
            ctx.fillStyle = '#a28b7d';
            ctx.fillText(`${musicProfile.name} · 배경음악 포함`, W / 2, 798);
            ctx.globalAlpha = 1;
          }
        });
      }

      // 지구본 → 지도 전환 직후 화이트 플래시 잔광
      const sinceGlobe = elapsed - GLOBE;
      if (sinceGlobe >= 0 && sinceGlobe < 350) {
        ctx.fillStyle = `rgba(253,246,238,${1 - sinceGlobe / 350})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    await new Promise((resolve) => {
      const startAt = performance.now();
      const tick = (now) => {
        const elapsed = now - startAt;
        drawFrame(Math.min(elapsed, total));
        if (elapsed < total) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    recorder.stop();
    await done;

    const recordedMime = recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || format.mime || 'video/webm';
    const ext = getVideoExtension(recordedMime);
    const blob = new Blob(chunks, { type: getVideoBaseMime(recordedMime) });
    const fileName = `travel-diary-${state.trip.date || 'memory'}.${ext}`;
    const saveResult = await saveMemoryVideo(blob, fileName, recordedMime);
    const formatLabel = getVideoLabel(recordedMime);
    if (saveResult === 'saved') showToast(`${formatLabel} 영상이 음악과 함께 저장됐어요 🎬`);
    else if (saveResult === 'shared') showToast(`${formatLabel} 영상을 음악과 함께 공유창으로 보냈어요 🎬`);
    else if (saveResult === 'cancelled') showToast('영상 저장을 취소했어요.');
    else showToast(`${formatLabel} 영상을 음악과 함께 다운로드했어요 🎬`);
  } catch (error) {
    console.error(error);
    showToast('영상 만들기에 실패했어요.');
  } finally {
    if (audioCtx) audioCtx.close().catch(() => {});
    if (button) { button.disabled = false; button.textContent = '🎬 영상'; }
  }
}

window.addEventListener('beforeunload', cleanupGeneratedPhotoUrls);
bootstrap();
