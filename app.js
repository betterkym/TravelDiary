const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || '';
const STORAGE_KEY = 'travel-diary.trips.v1';
const PHOTO_SPOT_RADIUS_M = 100;
const PHOTO_SPOT_MIN_DURATION_MS = 10 * 60 * 1000;
const PHOTO_SPOT_MIN_COUNT = 3;
const PHOTO_SPOT_GAP_MS = 10 * 60 * 1000;
const FOOTPRINT_MIN_DISTANCE_M = 12;
const FOOTPRINT_MIN_GAP_MS = 8000;

const state = {
  screen: 'create',
  mapState: 'before',
  diaryUnlocked: false,
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
    title: '탈린의 겨울 산책',
    date: '2026-07-15',
    region: '에스토니아 탈린',
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
  tripTitle: document.getElementById('trip-title'),
  tripDate: document.getElementById('trip-date'),
  tripRegion: document.getElementById('trip-region'),
  tripSummaryText: document.getElementById('trip-summary-text'),
  diarySummaryText: document.getElementById('diary-summary-text'),
  calendarToggle: document.getElementById('calendar-toggle'),
  tripHistory: document.getElementById('trip-history'),
  mapCanvas: document.getElementById('map'),
  recordingBadge: document.getElementById('recording-badge'),
  recordingTime: document.getElementById('recording-time'),
  photoImportPanel: document.getElementById('photo-import-panel'),
  photoImportButton: document.getElementById('photo-import-button'),
  photoInput: document.getElementById('photo-input'),
  startRecording: document.getElementById('start-recording'),
  endRecording: document.getElementById('end-recording'),
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
      title: trip.title || '여행',
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

function parsePhotoFile(file) {
  return Promise.all([file.arrayBuffer(), fileToDataUrl(file)]).then(([buffer, dataUrl]) => {
    const exif = parseExifBuffer(buffer);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `photo_${Math.random().toString(16).slice(2)}`,
      fileName: file.name,
      dataUrl,
      takenAt: exif.takenAt || new Date(file.lastModified || Date.now()),
      lat: exif.lat ?? null,
      lng: exif.lng ?? null,
    };
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

  const last = samples[samples.length - 1];
  if (last) {
    ensureCurrentMarker([last.lng, last.lat]);
    centerMapOn([last.lng, last.lat], 15.5);
  }
}

function renderTripHistory() {
  if (!elements.tripHistory) return;
  if (!state.savedTrips.length) {
    elements.tripHistory.innerHTML = '<span class="trip-chip">저장된 여행이 아직 없어요</span>';
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
  const summary = `${title} · ${formatDateLabel(date)} · ${region}`;
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
  state.map.on('load', () => {
    ensureRouteLayer();
    const trip = getSelectedTrip();
    if (trip) {
      renderTripOnMap(trip);
    }
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
  const isActiveTrip = state.selectedTripId && state.selectedTripId === state.activeTripId;
  elements.recordingBadge.hidden = mapState !== 'recording';
  elements.photoImportPanel.hidden = !(mapState === 'after' && isActiveTrip);
  elements.startRecording.hidden = mapState !== 'before' || !isActiveTrip;
  elements.endRecording.hidden = mapState !== 'recording';
  if (!isActiveTrip) {
    elements.startRecording.hidden = true;
    elements.endRecording.hidden = true;
    elements.photoImportPanel.hidden = true;
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

  const shouldDropFootprint =
    !state.lastFootprintLngLat ||
    distanceMeters(state.lastFootprintLngLat, lngLat) >= FOOTPRINT_MIN_DISTANCE_M ||
    timestamp - state.lastFootprintAt >= FOOTPRINT_MIN_GAP_MS;

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

function buildClusters(photos) {
  const groups = [];
  for (const photo of photos) {
    const lastGroup = groups[groups.length - 1];
    const photoPoint = [photo.lng, photo.lat];
    const photoTime = photo.takenAt.getTime();
    if (lastGroup) {
      const gap = photoTime - lastGroup.lastTakenAt;
      const distance = distanceMeters(lastGroup.center, photoPoint);
      if (gap <= PHOTO_SPOT_GAP_MS && distance <= PHOTO_SPOT_RADIUS_M) {
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
      firstTakenAt: photoTime,
      lastTakenAt: photoTime,
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

function formatDateTimeLabel(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

async function generateDiaryFromFiles(files) {
  const parsed = await Promise.all(files.map(parsePhotoFile));
  const photoData = parsed
    .map((photo) => {
      if ((photo.lat == null || photo.lng == null) && photo.takenAt) {
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

  photoData.sort((a, b) => a.takenAt - b.takenAt);
  const clusters = buildClusters(photoData);
  const qualifying = clusters.filter((cluster) => {
    const duration = cluster.lastTakenAt - cluster.firstTakenAt;
    return cluster.photos.length >= PHOTO_SPOT_MIN_COUNT && duration >= PHOTO_SPOT_MIN_DURATION_MS;
  });

  const targetClusters = qualifying.length ? qualifying : clusters.slice(0, 1);
  const entries = [];

  for (let i = 0; i < targetClusters.length; i += 1) {
    const cluster = targetClusters[i];
    const firstPhoto = cluster.photos[0];
    const durationMinutes = Math.max(1, Math.round((cluster.lastTakenAt - cluster.firstTakenAt) / 60000));
    const timeLabel = formatTimeLabel(firstPhoto.takenAt);
    const fallbackPlace = `기록 스팟 ${i + 1}`;
    const place = await resolvePlaceName(cluster.center[0], cluster.center[1], fallbackPlace);
    const photoCount = cluster.photos.length;
    const photoUrls = cluster.photos.map((photo) => photo.dataUrl);
    entries.push({
      time: timeLabel,
      place,
      note: `반경 ${PHOTO_SPOT_RADIUS_M}m 안에서 ${durationMinutes}분 동안 머무르며 사진 ${photoCount}장을 기록했어요.`,
      photoCount,
      photoUrls,
      mainPhoto: photoUrls[0],
      center: cluster.center,
      timestamp: firstPhoto.takenAt,
      durationMinutes,
    });
  }

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
  updateNavButtons();
  renderTripHistory();
  renderTimeline(entries);
  setScreen('diary');
  showToast('오늘의 여정이 다이어리로 정리되었습니다');
}

function renderTimeline(entries = state.generatedDiary || state.sampleTimeline) {
  elements.timeline.innerHTML = entries
    .map((entry, index) => {
      const gallery = Array.isArray(entry.photoUrls)
        ? `
          <div class="timeline-gallery">
            ${entry.photoUrls.slice(0, 4).map((url) => `<img class="timeline-thumb" src="${url}" alt="${entry.place} 사진" />`).join('')}
          </div>
        `
        : '';
      const preview = entry.mainPhoto || entry.image || '';
      return `
        <article class="timeline-entry">
          <div class="timeline-rail">
            <div class="timeline-dot"></div>
          </div>
          <div class="timeline-card">
            <div class="timeline-meta">
              <p class="timeline-time">${entry.time}</p>
              <button class="timeline-button" type="button" data-view-map="${index}">지도에서 보기</button>
            </div>
            <h3 class="timeline-place">${entry.place}</h3>
            <div class="timeline-photo-row">
              <p class="timeline-count">${entry.photoCount ? `사진 ${entry.photoCount}장` : ''}</p>
              <p class="timeline-count">${entry.durationMinutes ? `${entry.durationMinutes}분 기록` : ''}</p>
            </div>
            ${preview ? `<img class="timeline-photo" src="${preview}" alt="${entry.place} 대표 사진" />` : ''}
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
  elements.tripTitle.value = state.trip.title;
  elements.tripDate.value = state.trip.date;
  elements.tripRegion.value = state.trip.region;
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
  clearLiveMarkers();
  updateTripTexts();
  upsertSavedTrip(trip);
  renderTripHistory();
  renderTimeline();
  setScreen('map');
  setMapState('before');
  renderTripOnMap(trip);
}

function handleNav(target) {
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
    createTrip();
  });
  elements.createTripButton.addEventListener('click', createTrip);
  elements.startRecording.addEventListener('click', startRecording);
  elements.endRecording.addEventListener('click', endRecording);
  elements.photoImportButton.addEventListener('click', () => {
    elements.photoInput.value = '';
    elements.photoInput.click();
  });
  if (elements.calendarToggle) {
    elements.calendarToggle.addEventListener('click', openCalendar);
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
      await generateDiaryFromFiles(files);
    } catch (error) {
      console.error(error);
      showToast('사진 처리 중 오류가 발생했어요.');
    }
  });
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => handleNav(button.dataset.nav));
  });
}

window.addEventListener('beforeunload', cleanupGeneratedPhotoUrls);
bootstrap();
