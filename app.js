const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const STORAGE_KEY = 'travel-diary.trips.v1';
const API_BASE_URL = window.API_BASE_URL || '';
const PHOTO_SPOT_RADIUS_M = 120;
const PHOTO_SPOT_MIN_DURATION_MS = 10 * 60 * 1000;
const PHOTO_SPOT_MIN_COUNT = 3;
const PHOTO_SPOT_GAP_MS = 15 * 60 * 1000;
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
  routeLine: null,
  locationSamples: [],
  lastFootprintAt: 0,
  lastFootprintLngLat: null,
  generatedDiary: null,
  photoUrls: [],
  savedTrips: [],
  selectedTripId: null,
  activeTripId: null,
  activeTrip: null,
  calendarOpen: false,
  calendarMonth: null,
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
  createPhotoImportProgress: document.getElementById('create-photo-import-progress'),
  photoInput: document.getElementById('photo-input'),
  createUploadButton: document.getElementById('create-upload-button'),
  livePhotoButton: document.getElementById('live-photo-button'),
  livePhotoInput: document.getElementById('live-photo-input'),
  startRecording: document.getElementById('start-recording'),
  endRecording: document.getElementById('end-recording'),
  deleteDiaryButton: document.getElementById('delete-diary-button'),
  completeDiaryButton: document.getElementById('complete-diary-button'),
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

function getCalendarMonthDate() {
  if (state.calendarMonth instanceof Date && !Number.isNaN(state.calendarMonth.getTime())) {
    return new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  }
  const selectedTrip = getSelectedTrip();
  if (selectedTrip?.date) {
    const parsed = new Date(`${normalizeDateKey(selectedTrip.date)}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function setCalendarMonth(date) {
  state.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendar();
}

function openCalendar() {
  const selectedTrip = getSelectedTrip();
  const anchor = selectedTrip?.date
    ? new Date(`${normalizeDateKey(selectedTrip.date)}T00:00:00`)
    : new Date();
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
  const selectedDateKey = getSelectedTrip() ? normalizeDateKey(getSelectedTrip().date) : '';
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
      <span class="calendar-day-label">${trip ? trip.title : '기록 없음'}</span>
    `;
    if (trip) {
      button.addEventListener('click', () => {
        pickTrip(trip.id);
        renderTripOnMap(trip);
        closeCalendar();
      });
    } else {
      button.disabled = true;
      button.classList.add('is-muted');
    }
    elements.calendarGrid.appendChild(button);
  }
}

function readSavedTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((trip) => ({
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
      },
      diary: Array.isArray(trip.diary) ? trip.diary : [],
      photos: Array.isArray(trip.photos) ? trip.photos : [],
    }));
  } catch {
    return [];
  }
}

function writeSavedTrips() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedTrips));
  } catch {
    // Ignore storage quota errors in the MVP.
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
    },
    diary: trip.diary ?? [],
    photos: trip.photos ?? [],
    status: trip.status ?? 'draft',
  };
}

function upsertSavedTrip(trip) {
  const record = createTripRecord(trip);
  const dateKey = normalizeDateKey(record.date);
  const index = state.savedTrips.findIndex(
    (item) => item.id === record.id || normalizeDateKey(item.date) === dateKey,
  );
  if (index >= 0) {
    state.savedTrips[index] = record;
  } else {
    state.savedTrips.unshift(record);
  }
  state.savedTrips = dedupeTripsByDate(state.savedTrips);
  writeSavedTrips();
  return record;
}

function getSelectedTrip() {
  return state.savedTrips.find((trip) => trip.id === state.selectedTripId) || state.savedTrips[0] || null;
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
  state.generatedDiary = trip.diary && trip.diary.length ? trip.diary : null;
  state.diaryUnlocked = Boolean(state.generatedDiary);
  state.locationSamples = trip.recording?.samples ?? [];
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
  if (!state.map || state.map.getSource('trip-route-source')) return;
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
}

function setRouteLine(coordinates) {
  if (!state.map || !state.map.getSource('trip-route-source')) return;
  state.map.getSource('trip-route-source').setData({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {},
  });
}

function renderTripOnMap(trip) {
  if (!state.map) return;
  clearLiveMarkers();
  ensureRouteLayer();

  const samples = trip?.recording?.samples || [];
  const coordinates = samples.map((sample) => [sample.lng, sample.lat]);
  setRouteLine(coordinates);

  (trip?.recording?.footprints || []).forEach((point) => {
    addFootprint([point.lng, point.lat]);
  });

  (trip?.recording?.livePhotos || []).forEach((photo) => {
    if (photo.dataUrl && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
      addLivePhotoMarker([photo.lng, photo.lat], photo.dataUrl);
    }
  });

  // 실시간 GPS 기록이 없고 업로드한 사진만 있는 여행: 사진/다이어리 위치로 경로·발자취 표시
  if (!samples.length) {
    let points = [];
    // 1순위: 저장된 사진 좌표
    if (Array.isArray(trip?.photos) && trip.photos.length) {
      points = trip.photos
        .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
        .sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt))
        .map((p) => [p.lng, p.lat]);
    }
    // 2순위: 다이어리 엔트리 위치(항상 보존됨)
    if (!points.length && Array.isArray(trip?.diary) && trip.diary.length) {
      points = trip.diary
        .filter((e) => Array.isArray(e.center) && Number.isFinite(e.center[0]) && Number.isFinite(e.center[1]))
        .map((e) => e.center);
    }
    if (points.length) {
      setRouteLine(points);
      points.forEach((pt) => addFootprint(pt));
      centerMapOn(points[points.length - 1], 14);
    }
  }

  const last = samples[samples.length - 1];
  if (last) {
    ensureCurrentMarker([last.lng, last.lat]);
    centerMapOn([last.lng, last.lat], 15.5);
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

function showToast(message) {
  elements.toast.querySelector('p').textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1800);
}

function setUploadProgress(text, visible = true) {
  const targets = [elements.photoImportProgress, elements.createPhotoImportProgress].filter(Boolean);
  if (!targets.length) return;
  targets.forEach((target) => {
    target.textContent = text;
    target.hidden = !visible;
  });
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
  if (state.activeTrip) {
    state.activeTrip.recording.samples.push({
      lng: lngLat[0],
      lat: lngLat[1],
      timestamp,
    });
    setRouteLine(state.activeTrip.recording.samples.map((sample) => [sample.lng, sample.lat]));
    upsertSavedTrip(state.activeTrip);
  }

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

  clearLiveMarkers();
  state.locationSamples = [];
  state.generatedDiary = null;
  state.diaryUnlocked = false;
  updateNavButtons();

  stopTracking();
  state.recordingStartedAt = Date.now();
  state.recordingBonusSeconds = 0;
  state.recordingElapsed = 0;
  if (state.activeTrip) {
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
  setMapState('after');
  if (state.activeTrip) {
    state.activeTrip.recording.endedAt = new Date().toISOString();
    state.activeTrip.recording.elapsed = state.recordingElapsed;
    state.activeTrip.status = 'recorded';
    upsertSavedTrip(state.activeTrip);
  }
  state.diaryUnlocked = false;
  updateNavButtons();
  showToast('오늘의 여정이 사진첩과 연결되었습니다. 사진 불러오기 버튼을 눌러 주세요.');
  return;
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

async function suggestTitleFromLocation(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  // 사용자가 직접 넣은 제목이 있으면 유지. 비었거나 기본값('새 여행')이면 교체.
  const current = (state.trip.title || '').trim();
  if (current && current !== '새 여행') return;

  const placeName = await resolvePlaceName(lng, lat, '');
  if (!placeName) return;
  const title = `${placeName.split(',')[0].trim()} 여행`;

  state.trip.title = title;
  if (elements.tripTitle) elements.tripTitle.value = title;
  if (state.activeTrip) {
    state.activeTrip.title = title;
    upsertSavedTrip(state.activeTrip);
  }
  updateTripTexts();
  renderTripHistory();
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

function selectRepresentativePhotos(photos, maxCount = 3) {
  const selected = [];
  for (const photo of photos) {
    if (!photo) continue;
    if (!selected.length) {
      selected.push(photo);
      continue;
    }
    const lastSelected = selected[selected.length - 1];
    const timeGap = Math.abs((photo.takenAt?.getTime?.() || 0) - (lastSelected.takenAt?.getTime?.() || 0));
    const distance = Number.isFinite(photo.lat) && Number.isFinite(photo.lng) && Number.isFinite(lastSelected.lat) && Number.isFinite(lastSelected.lng)
      ? distanceMeters([lastSelected.lng, lastSelected.lat], [photo.lng, photo.lat])
      : Infinity;
    if (timeGap <= 2 * 60 * 1000 && distance <= 20) {
      continue;
    }
    selected.push(photo);
    if (selected.length >= maxCount) break;
  }
  return selected;
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

function normalizeTimelineEntries(entries) {
  const dayIndexByDate = new Map();
  let nextDayIndex = 1;
  return entries.map((entry) => {
    const timestamp = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
    const dateKey = getLocalDateKey(timestamp);
    if (!dayIndexByDate.has(dateKey)) {
      dayIndexByDate.set(dateKey, nextDayIndex);
      nextDayIndex += 1;
    }
    return {
      ...entry,
      timestamp,
      dayLabel: `${dayIndexByDate.get(dateKey)}일차`,
    };
  });
}

function diaryFromApi(diary) {
  if (!diary) return null;
  const timeline = Array.isArray(diary.timeline) ? diary.timeline : [];
  const dayIndexByDate = new Map();
  let nextDayIndex = 1;
  return timeline.map((entry, index) => {
    const entryDate = new Date(entry.time);
    const dateKey = getLocalDateKey(entryDate);
    if (!dayIndexByDate.has(dateKey)) {
      dayIndexByDate.set(dateKey, nextDayIndex);
      nextDayIndex += 1;
    }
    const dayIndex = dayIndexByDate.get(dateKey);
    return {
      photoId: diary.selected_photos?.[index]?.photo_id || entry.photo_url || index,
      photoIds: diary.selected_photos?.slice(index, index + 3).map((photo) => photo.photo_id) || [],
      time: formatRoundedTimeLabel(entryDate),
      dateLabel: `${formatMonthDay(entryDate)} · ${diary.title || state.trip.title || '여행'}`,
      dayLabel: `${dayIndex}일차`,
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
    state.generatedDiary = normalizeTimelineEntries(snapshot.entries);
    state.diaryUnlocked = true;
    state.photoUrls = Array.isArray(snapshot.photoUrls) ? snapshot.photoUrls : [];
    state.trip = {
      title: snapshot.title || state.trip.title,
      date: snapshot.date || state.trip.date,
      region: snapshot.region || state.trip.region,
    };
    updateTripTexts();
    updateNavButtons();
    renderTimeline(state.generatedDiary);
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
    state.generatedDiary = normalizeTimelineEntries(restoredEntries);
    state.diaryUnlocked = true;
    state.trip = {
      title: diary.title || state.trip.title,
      date: state.trip.date,
      region: state.trip.region,
    };
    updateTripTexts();
    updateNavButtons();
    renderTimeline(state.generatedDiary);
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
    const photo = entry.photo_url ? toAbsolutePhotoUrl(entry.photo_url) : '';
    const hasCenter = Number.isFinite(entry.lng) && Number.isFinite(entry.lat);
    return {
      time: when && !Number.isNaN(when.getTime()) ? formatRoundedTimeLabel(when) : '',
      place: entry.place || `기록 스팟 ${index + 1}`,
      note: entry.note || '',
      photoUrls: photo ? [photo] : [],
      mainPhoto: photo || null,
      photoCount: 1,
      center: hasCenter ? [entry.lng, entry.lat] : null,
      timestamp: when && !Number.isNaN(when.getTime()) ? when : new Date(),
      dateLabel: data.title || state.trip.title || '여행',
    };
  });

  state.generatedDiary = normalizeTimelineEntries(entries);
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
  // 위치 기반 자동 제목 (사진 첫 스팟 기준). 실패 시 백엔드 제목으로 폴백.
  const firstEntry = entries.find((e) => Array.isArray(e.center));
  if (firstEntry) {
    await suggestTitleFromLocation(firstEntry.center[0], firstEntry.center[1]);
  }
  if (!(state.trip.title || '').trim() && data.title) {
    state.trip.title = data.title;
    if (state.activeTrip) { state.activeTrip.title = data.title; upsertSavedTrip(state.activeTrip); }
    updateTripTexts();
  }
  updateNavButtons();
  renderTripHistory();
  renderTimeline(state.generatedDiary);
  setScreen('diary');
  showToast('AI가 위치별 대표 사진을 골라 다이어리를 만들었어요 ✨');
  return true;
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
    const selectedPhotos = selectRepresentativePhotos(cluster.photos, 3);
    const photoUrls = selectedPhotos.map((photo) => photo.url || photo.dataUrl);
    entries.push({
      photoId: selectedPhotos[0].id,
      photoIds: selectedPhotos.map((photo) => photo.id),
      time: timeLabel,
      dateLabel: `${formatMonthDay(firstPhoto.takenAt)} · ${tripName}`,
      dayLabel: `${dayIndex}일차`,
      place,
      note: `반경 ${PHOTO_SPOT_RADIUS_M}m 안에서 사진 ${photoCount}장을 기록했어요.`,
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
      const place = escapeHtml(entry.place || '기록 스팟');
      const note = entry.note || '';
      const noteHtml = escapeHtml(note);
      const dateLabel = escapeHtml(entry.dateLabel || '');
      const timeLabel = escapeHtml(entry.dayLabel ? `${entry.dayLabel} · ${entry.time}` : entry.time || '');
      const gallery = photoUrls.length
        ? `
          <div class="timeline-gallery timeline-gallery--${photoUrls.length}">
            ${photoUrls.map((url, photoIndex) => `
              <div class="timeline-photo-wrap">
                <img class="timeline-thumb" src="${escapeHtml(url)}" alt="${place} 사진 ${photoIndex + 1}" />
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
            <h3 class="timeline-place">${place}</h3>
            <div class="timeline-photo-row">
              <p class="timeline-count">${entry.photoCount ? `사진 ${entry.photoCount}장` : ''}</p>
              <p class="timeline-count">${entry.durationMinutes ? `${entry.durationMinutes}분 기록` : ''}</p>
            </div>
            ${photoUrls.length >= 3 ? '<p class="timeline-note timeline-note--hint">대표 사진을 골라 보여드려요.</p>' : ''}
            ${gallery}
            <div class="timeline-note-block" data-note-block="${index}">
              <div class="timeline-note-head">
                <span class="timeline-note-label">AI 메모 초안</span>
                <button class="timeline-note-edit" type="button" data-edit-note="${index}">수정</button>
              </div>
              <p class="timeline-note" data-note-text="${index}">${noteHtml}</p>
              <textarea class="timeline-note-input" data-note-input="${index}" maxlength="300" hidden>${noteHtml}</textarea>
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
      if (!input || !text || !actions) return;
      input.hidden = false;
      text.hidden = true;
      actions.hidden = false;
      button.hidden = true;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
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
    },
    diary: [],
    photos: [],
  };
  state.activeTripId = trip.id;
  state.activeTrip = trip;
  state.selectedTripId = trip.id;
  state.trip = {
    title: trip.title,
    date: trip.date,
    region: trip.region,
  };
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
        showToast('여행이 서버에 생성되었어요. 이제 사진을 올릴 수 있어요.');
      }
    })
    .catch((error) => {
      console.error(error);
      showToast('여행 생성 API 연결은 실패했지만, 로컬 화면은 사용할 수 있어요.');
    });
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

// 기록 중 현장 사진 촬영/추가 → 즉시 지도 반영
async function handleLivePhotoCapture(files) {
  const lngLat = getCurrentLngLat();
  if (!lngLat) {
    showToast('현재 위치를 아직 못 잡았어요. 잠시 후 다시 시도해 주세요.');
    return;
  }
  for (const file of files) {
    try {
      const dataUrl = await fileToDataUrl(file);
      addLivePhotoMarker(lngLat, dataUrl);
      if (state.activeTrip) {
        state.activeTrip.recording.livePhotos = state.activeTrip.recording.livePhotos || [];
        state.activeTrip.recording.livePhotos.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `live_${Math.random().toString(16).slice(2)}`,
          dataUrl,
          lng: lngLat[0],
          lat: lngLat[1],
          takenAt: new Date().toISOString(),
        });
        upsertSavedTrip(state.activeTrip);
      }
    } catch (error) {
      console.error(error);
    }
  }
  showToast('현장 사진을 지도에 추가했어요 📍');
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
  const trip = target === 'map' || target === 'diary' ? syncSelectedTripView() : null;
  closeCalendar();
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

    xhr.upload.addEventListener('loadstart', () => {
      setUploadProgress('업로드 시작...', true);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        setUploadProgress('업로드 중...', true);
        return;
      }
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      setUploadProgress(`업로드 중 ${percent}%`, true);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress('업로드 완료', true);
        window.setTimeout(() => setUploadProgress('', false), 2000);
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
    setUploadProgress('업로드 준비 중...', true);
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

function persistDiaryNoteLocally(entryIndex, note, entries) {
  if (Array.isArray(entries) && entries[entryIndex]) {
    entries[entryIndex].note = note;
  }
  if (Array.isArray(state.generatedDiary) && state.generatedDiary[entryIndex]) {
    state.generatedDiary[entryIndex].note = note;
  }

  const selectedTrip = getSelectedTrip();
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
