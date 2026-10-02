import { audioManager } from './audio.js';
import { loadSettings, saveSettings, loadColorLabState, saveColorLabState } from './storage.js';

// ---------- Pigment model ----------
// Chromatic pigments (red/yellow/blue/orange/green/indigo/violet) are mixed
// with each other using a geometric weighted mean of their reflectance
// (normalized 0-1 per RGB channel). This mimics subtractive paint mixing
// much better than a plain RGB average: Red+Yellow -> Orange, Yellow+Blue ->
// Green, Red+Blue -> Purple. White/black are blended in afterwards as a
// linear tint/shade instead (see mixColors) so they lighten/darken
// proportionally to volume rather than being damped by the log curve.
const PIGMENTS = {
  red: { name: 'Đỏ', emoji: '🟥', tier: 1, reflect: [0.90, 0.12, 0.12] },
  yellow: { name: 'Vàng', emoji: '🟨', tier: 1, reflect: [1.00, 0.87, 0.20] },
  blue: { name: 'Xanh dương', emoji: '🟦', tier: 1, reflect: [0.16, 0.39, 0.86] },
  white: { name: 'Trắng', emoji: '⬜', tier: 2, reflect: [0.97, 0.97, 0.95] },
  black: { name: 'Đen', emoji: '⬛', tier: 2, reflect: [0.08, 0.08, 0.09] },
  orange: { name: 'Cam', emoji: '🟧', tier: 3, reflect: [1.00, 0.55, 0.10] },
  green: { name: 'Xanh lá', emoji: '🟩', tier: 3, reflect: [0.25, 0.70, 0.30] },
  indigo: { name: 'Chàm', emoji: '🟪', tier: 3, reflect: [0.20, 0.15, 0.55] },
  violet: { name: 'Tím', emoji: '🟣', tier: 3, reflect: [0.55, 0.20, 0.65] },
};
const SHELF_ORDER = ['red', 'yellow', 'blue', 'white', 'black', 'orange', 'green', 'indigo', 'violet'];
// Pigments that participate in the hue-mixing (geometric mean) step. White and
// black are handled separately as a linear tint/shade so they lighten/darken
// proportionally to volume instead of being damped by the log curve.
const CHROMATIC_IDS = new Set(['red', 'yellow', 'blue', 'orange', 'green', 'indigo', 'violet']);
const TIER_REQUIREMENTS = { 2: 3, 3: 10 };
const BEAKER_MAX = 100;
const POUR_STEP = 10;
const COLOR_BUCKET = 20;

const OBJECT_TARGETS = [
  { emoji: '🍎', name: 'quả táo', rgb: [196, 30, 40] },
  { emoji: '🍊', name: 'quả cam', rgb: [237, 129, 29] },
  { emoji: '🍌', name: 'quả chuối', rgb: [246, 206, 63] },
  { emoji: '🌿', name: 'lá cây', rgb: [67, 143, 63] },
  { emoji: '🌊', name: 'nước biển', rgb: [43, 118, 173] },
  { emoji: '🍇', name: 'chùm nho', rgb: [110, 61, 133] },
  { emoji: '🥕', name: 'củ cà rốt', rgb: [232, 118, 34] },
  { emoji: '🌅', name: 'hoàng hôn', rgb: [230, 103, 60] },
  { emoji: '🍉', name: 'ruột dưa hấu', rgb: [221, 75, 99] },
  { emoji: '🌳', name: 'tán cây', rgb: [53, 122, 58] },
];

const ACHIEVEMENTS = {
  juniorScientist: { icon: '🔬', name: 'Nhà Khoa Học Nhí', desc: 'Khám phá 10 màu sắc', check: () => labState.colorBook.length >= 10 },
  littleChemist: { icon: '⚗️', name: 'Nhà Hóa Học Nhỏ', desc: 'Khám phá 50 màu sắc', check: () => labState.colorBook.length >= 50 },
  rainbowMaster: { icon: '🌈', name: 'Bậc Thầy Cầu Vồng', desc: 'Mở khóa toàn bộ Bộ Sưu Tập Cầu Vồng', check: () => labState.tier >= 3 },
  colorGenius: { icon: '🧠', name: 'Thiên Tài Màu Sắc', desc: 'Đạt 3 sao ở 15 lượt pha màu', check: () => labState.stats.perfectCount >= 15 },
};

const PAINT_PICTURES = {
  house: {
    label: '🏠 Ngôi nhà',
    build: () => `
      <svg viewBox="0 0 200 200" class="paint-svg">
        <rect x="0" y="0" width="200" height="140" fill="#cdeeff" />
        <rect x="0" y="140" width="200" height="60" fill="#bfe6a8" />
        <circle data-region="sun" cx="165" cy="35" r="18" fill="#ffffff" stroke="#333" stroke-width="2" />
        <polygon data-region="roof" points="30,100 100,45 170,100" fill="#ffffff" stroke="#333" stroke-width="2" />
        <rect data-region="wall" x="45" y="100" width="110" height="75" fill="#ffffff" stroke="#333" stroke-width="2" />
        <rect data-region="door" x="92" y="135" width="26" height="40" fill="#ffffff" stroke="#333" stroke-width="2" />
        <rect data-region="window1" x="58" y="113" width="22" height="22" fill="#ffffff" stroke="#333" stroke-width="2" />
        <rect data-region="window2" x="120" y="113" width="22" height="22" fill="#ffffff" stroke="#333" stroke-width="2" />
      </svg>`,
  },
  flower: {
    label: '🌸 Bông hoa',
    build: () => {
      let petals = '';
      for (let i = 0; i < 5; i++) {
        petals += `<ellipse data-region="petal${i}" cx="100" cy="70" rx="18" ry="28" fill="#ffffff" stroke="#333" stroke-width="2" transform="rotate(${i * 72} 100 110)" />`;
      }
      return `
        <svg viewBox="0 0 200 200" class="paint-svg">
          <rect x="0" y="0" width="200" height="200" fill="#eaf6ff" />
          <rect data-region="stem" x="95" y="110" width="10" height="70" fill="#ffffff" stroke="#333" stroke-width="2" />
          <ellipse data-region="leaf" cx="80" cy="150" rx="18" ry="9" fill="#ffffff" stroke="#333" stroke-width="2" />
          ${petals}
          <circle data-region="center" cx="100" cy="110" r="16" fill="#ffffff" stroke="#333" stroke-width="2" />
        </svg>`;
    },
  },
  rainbow: {
    label: '🌈 Cầu vồng',
    build: () => {
      let rings = '';
      for (let i = 0; i < 7; i++) {
        const size = 170 - i * 20;
        rings += `<div class="paint-region rainbow-ring" data-region="ring${i}" style="width:${size}px;height:${size / 2}px;"></div>`;
      }
      return `<div class="rainbow-arch">${rings}</div>`;
    },
  },
};

// ---------- DOM references ----------
const feedbackEl = document.getElementById('game7Feedback');
const discoveredEl = document.getElementById('game7Discovered');
const modeLabelEl = document.getElementById('game7ModeLabel');
const modeSelectScreen = document.getElementById('modeSelectScreen');
const labScreen = document.getElementById('labScreen');
const missionPanel = document.getElementById('missionPanel');
const missionLabelEl = document.getElementById('missionLabel');
const missionTargetEl = document.getElementById('missionTarget');
const workspaceEl = document.querySelector('.game7-workspace');
const colorShelfEl = document.getElementById('colorShelf');
const measureAreaEl = document.getElementById('measureArea');
const beakerEl = document.getElementById('beaker');
const beakerLiquidEl = document.getElementById('beakerLiquid');
const beakerLayersEl = document.getElementById('beakerLayers');
const beakerMixedEl = document.getElementById('beakerMixedColor');
const stirRodEl = document.getElementById('stirRod');
const beakerVolumeEl = document.getElementById('beakerVolume');
const beakerRatioEl = document.getElementById('beakerRatio');
const btnStir = document.getElementById('btnStir');
const btnCheck = document.getElementById('btnCheck');
const btnResetBeaker = document.getElementById('btnResetBeaker');
const paintPanel = document.getElementById('paintPanel');
const paintPickerEl = document.getElementById('paintPicker');
const paintCanvasWrapEl = document.getElementById('paintCanvasWrap');
const paintModeCard = document.getElementById('paintModeCard');
const btnMusicToggle = document.getElementById('btnMusicToggle7');
const btnModeSelect = document.getElementById('btnModeSelect');
const btnColorBook = document.getElementById('btnColorBook');
const btnAchievements = document.getElementById('btnAchievements');
const colorBookModal = document.getElementById('colorBookModal');
const colorBookListEl = document.getElementById('colorBookList');
const closeColorBook = document.getElementById('closeColorBook');
const achievementsModal = document.getElementById('achievementsModal');
const achievementsListEl = document.getElementById('achievementsList');
const closeAchievements = document.getElementById('closeAchievements');
const resultModal = document.getElementById('resultModal');
const resultTitleEl = document.getElementById('resultTitle');
const resultStarsEl = document.getElementById('resultStars');
const resultDetailEl = document.getElementById('resultDetail');
const resultNext = document.getElementById('resultNext');
const resultRetry = document.getElementById('resultRetry');
const unlockModal = document.getElementById('unlockModal');
const unlockTextEl = document.getElementById('unlockText');
const closeUnlock = document.getElementById('closeUnlock');
const discoveryToast = document.getElementById('discoveryToast');
const discoveryTitleEl = document.getElementById('discoveryTitle');
const discoverySwatchEl = document.getElementById('discoverySwatch');
const discoveryNameEl = document.getElementById('discoveryName');

// ---------- State ----------
const settings = loadSettings();
audioManager.setMusicOn(settings.musicOn);
updateMusicIcon();

const labState = loadColorLabState();
let currentMode = null;
let currentTarget = null;
let amounts = {};
let pourOrder = [];
let baseMix = null; // { rgb, volume } snapshot of the last stirred color, frozen until reset
let freshAmounts = {}; // ml poured since the last stir, rendered as a layer above baseMix
let freshOrder = [];
let isMixed = false;
let feedbackTimer = null;
let toastHideTimer = null;
let unlockQueue = [];

function updateMusicIcon() {
  btnMusicToggle.textContent = settings.musicOn ? '🔊' : '🔇';
}

btnMusicToggle.addEventListener('click', () => {
  settings.musicOn = !settings.musicOn;
  saveSettings(settings);
  audioManager.setMusicOn(settings.musicOn);
  updateMusicIcon();
});

// ---------- Helpers ----------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function shuffleArray(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function pigmentColor(id) {
  const [r, g, b] = PIGMENTS[id].reflect.map((v) => Math.round(v * 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function unlockedColorIds() {
  return SHELF_ORDER.filter((id) => PIGMENTS[id].tier <= labState.tier);
}

function totalVolume() {
  return Object.values(amounts).reduce((sum, ml) => sum + ml, 0);
}

function mixColors(mix) {
  const entries = Object.entries(mix).filter(([, ml]) => ml > 0);
  const total = entries.reduce((sum, [, ml]) => sum + ml, 0);
  if (total <= 0) return null;

  const whiteMl = mix.white || 0;
  const blackMl = mix.black || 0;
  const colorEntries = entries.filter(([id]) => CHROMATIC_IDS.has(id));
  const colorMl = total - whiteMl - blackMl;

  // 1. Mix only the chromatic pigments with the geometric (log) mean — this
  // is what produces Red+Yellow=Orange, Yellow+Blue=Green, etc. The result
  // is irrelevant (and left as a zero placeholder) when colorMl is 0, since
  // its weight below will also be 0.
  let base = [0, 0, 0];
  if (colorMl > 0) {
    const channelSums = [0, 0, 0];
    colorEntries.forEach(([id, ml]) => {
      const weight = ml / colorMl;
      const reflect = PIGMENTS[id].reflect;
      for (let c = 0; c < 3; c++) {
        channelSums[c] += weight * Math.log(reflect[c]);
      }
    });
    base = channelSums.map((sum) => clamp01(Math.exp(sum)) * 255);
  }

  // 2. White/black act as a linear tint/shade instead of another
  // multiplicative filter. Treating them like regular pigments in the log
  // mean above made white barely lighten saturated colors (e.g. Red+White
  // stayed almost as saturated as pure Red) because the geometric mean is
  // always pulled toward the smallest channel value. Blending them in
  // proportionally to their share of the total volume lightens/darkens the
  // mixture the way kids actually expect from tinting/shading with paint.
  const colorWeight = colorMl / total;
  const whiteWeight = whiteMl / total;
  const blackWeight = blackMl / total;
  const whiteRgb = PIGMENTS.white.reflect.map((v) => v * 255);
  const blackRgb = PIGMENTS.black.reflect.map((v) => v * 255);

  return base.map((v, c) => {
    const blended = v * colorWeight + whiteRgb[c] * whiteWeight + blackRgb[c] * blackWeight;
    return Math.round(Math.max(0, Math.min(255, blended)));
  });
}

// Cheap, widely-used perceptual color distance ("redmean" approximation,
// see https://www.compuphase.com/cmetric.htm). It weights the G channel
// highest (human eyes are most sensitive to green) and skews the R/B
// weights based on average redness, which tracks human perception much
// better than plain Euclidean RGB distance without the instability that a
// Hue-based metric would have on the low-saturation colors this game
// produces a lot of now that white/black tint/shade linearly (see above).
function colorDistance(a, b) {
  const rMean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  const weightR = 2 + rMean / 256;
  const weightG = 4;
  const weightB = 2 + (255 - rMean) / 256;
  return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
}

// Worst case under the redmean metric (pure black vs pure white) — used to
// normalize distances into a 0-100% accuracy score.
const MAX_DIST = colorDistance([0, 0, 0], [255, 255, 255]);

function accuracyFromDistance(dist) {
  return Math.max(0, 100 - (dist / MAX_DIST) * 100);
}

function starsForAccuracy(acc) {
  if (acc >= 95) return 3;
  if (acc >= 80) return 2;
  if (acc >= 60) return 1;
  return 0;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      default: h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function nameColor(rgb) {
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // 1. Neutral grayscale bucket — hue is noisy/meaningless once saturation
  // is near zero, so this must be checked before any hue-based naming.
  if (s < 0.12) {
    if (l > 0.85) return 'Trắng Tinh';
    if (l < 0.15) return 'Đen Huyền';
    return l > 0.55 ? 'Xám Sáng' : 'Xám Đậm';
  }

  // 2. Dark, reasonably saturated warm hues (orange through yellow-green)
  // read as Brown/Olive to the eye, not "dark orange/yellow" — carve this
  // out before the regular hue bands. Orange-ish hues (~15-55°) land as
  // Brown; yellow-green hues (~55-95°) land as Olive/moss.
  if (l < 0.36 && s > 0.25 && h >= 15 && h < 95) {
    return h < 55 ? 'Nâu Đất' : 'Rêu Đậm';
  }

  // 3. Hue bands, wraparound-aware: Hue is a circle (0-360°), so Red sits at
  // BOTH ends of the wheel (345-360° and 0-15°), not just the low end. The
  // old sequential "h <= max" loop missed this and misclassified saturated
  // near-360° reds as a separate "Hồng" (pink) band.
  let hueName;
  if (h >= 345 || h < 15) hueName = 'Đỏ';
  else if (h < 45) hueName = 'Cam';
  else if (h < 65) hueName = 'Vàng';
  else if (h < 150) hueName = 'Xanh Lá';
  else if (h < 195) hueName = 'Ngọc Lam';
  else if (h < 245) hueName = 'Xanh Dương';
  else if (h < 275) hueName = 'Chàm';
  else if (h < 320) hueName = 'Tím';
  else hueName = 'Hồng Cánh Sen'; // 320-345: magenta/fuchsia

  // 4. Lightness/saturation modifiers. Pink is really just a light red (or
  // light magenta), so instead of keeping "Hồng" as its own hue band (which
  // used to collide with the modifiers and produce nonsense like
  // "Hồng Đậm" — a "dark pink"), special-case it here based on lightness.
  if (l > 0.78) {
    return hueName === 'Đỏ' || hueName === 'Hồng Cánh Sen' ? 'Hồng Nhạt' : `${hueName} Nhạt`;
  }
  if (l < 0.3) return `${hueName} Đậm`;
  return `${hueName} ${s > 0.55 ? 'Rực Rỡ' : 'Dịu'}`;
}

function colorKey(rgb) {
  return rgb.map((v) => Math.round(v / COLOR_BUCKET)).join('-');
}

function flashFeedback(msg, ok) {
  feedbackEl.textContent = msg;
  feedbackEl.className = `quiz-result ${ok ? 'quiz-correct' : 'quiz-wrong'}`;
  feedbackEl.classList.remove('hidden');
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => feedbackEl.classList.add('hidden'), 2600);
}

function showToast({ title, swatchStyle, swatchText, name }) {
  discoveryTitleEl.textContent = title;
  discoverySwatchEl.style.background = swatchStyle || '#fff';
  discoverySwatchEl.textContent = swatchText || '';
  discoveryNameEl.textContent = name;
  discoveryToast.classList.remove('hidden');
  requestAnimationFrame(() => discoveryToast.classList.add('show'));
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    discoveryToast.classList.remove('show');
    setTimeout(() => discoveryToast.classList.add('hidden'), 300);
  }, 3200);
}

function queueUnlock(text) {
  unlockQueue.push(text);
}

function showNextUnlockModal() {
  if (unlockQueue.length === 0 || !unlockModal.classList.contains('hidden')) return;
  unlockTextEl.innerHTML = unlockQueue.shift();
  unlockModal.classList.remove('hidden');
}

closeUnlock.addEventListener('click', () => {
  unlockModal.classList.add('hidden');
  if (unlockQueue.length > 0) setTimeout(showNextUnlockModal, 300);
});

// ---------- Tier unlocks & achievements ----------
function checkTierUnlock() {
  let unlocked = false;
  if (labState.tier < 2 && labState.colorBook.length >= TIER_REQUIREMENTS[2]) {
    labState.tier = 2;
    unlocked = true;
    queueUnlock('🔓 Bạn đã mở khóa màu <strong>Trắng ⬜</strong> và <strong>Đen ⬛</strong>! Hãy thử làm sáng hoặc làm tối màu sắc nhé.');
  }
  if (labState.tier < 3 && labState.colorBook.length >= TIER_REQUIREMENTS[3]) {
    labState.tier = 3;
    unlocked = true;
    queueUnlock('🔓 Bạn đã mở khóa <strong>Bộ Sưu Tập Cầu Vồng 🌈</strong> và chế độ <strong>Tô Tranh 🎨</strong>!');
  }
  if (unlocked) {
    saveColorLabState(labState);
    renderShelf();
    renderMeasure();
    renderModeLocks();
    showNextUnlockModal();
  }
}

function checkAchievements() {
  let changed = false;
  Object.entries(ACHIEVEMENTS).forEach(([key, ach]) => {
    if (!labState.achievements[key] && ach.check()) {
      labState.achievements[key] = true;
      changed = true;
      showToast({
        title: '🏆 Thành tích mới!',
        swatchStyle: 'linear-gradient(135deg,#ffd23f,#f0a35c)',
        swatchText: ach.icon,
        name: ach.name,
      });
    }
  });
  if (changed) saveColorLabState(labState);
}

function tryDiscover(rgb) {
  const key = colorKey(rgb);
  if (labState.colorBook.some((entry) => entry.key === key)) return null;
  const recipe = Object.entries(amounts)
    .filter(([, ml]) => ml > 0)
    .map(([id, ml]) => ({ id, ml }));
  const entry = { key, name: nameColor(rgb), rgb, recipe, discoveredAt: Date.now() };
  labState.colorBook.push(entry);
  saveColorLabState(labState);
  discoveredEl.textContent = labState.colorBook.length;
  return entry;
}

// ---------- Rendering: shelf / measure / beaker ----------
function renderShelf() {
  colorShelfEl.innerHTML = '';
  SHELF_ORDER.forEach((id) => {
    const pigment = PIGMENTS[id];
    const locked = pigment.tier > labState.tier;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `color-bottle${locked ? ' locked' : ''}`;
    btn.dataset.color = id;
    const swatch = document.createElement('div');
    swatch.className = 'color-bottle-swatch';
    swatch.style.background = locked ? '#ccc' : pigmentColor(id);
    swatch.textContent = locked ? '🔒' : pigment.emoji;
    const label = document.createElement('div');
    label.className = 'color-bottle-label';
    label.textContent = locked ? '???' : pigment.name;
    btn.appendChild(swatch);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      if (locked) {
        const need = TIER_REQUIREMENTS[pigment.tier] - labState.colorBook.length;
        flashFeedback(`🔒 Khám phá thêm ${Math.max(0, need)} màu nữa để mở khóa ${pigment.name}!`, false);
        return;
      }
      pourColor(id, btn);
    });
    colorShelfEl.appendChild(btn);
  });
}

function renderMeasure() {
  const unlocked = unlockedColorIds();
  measureAreaEl.innerHTML = '';
  unlocked.forEach((id) => {
    const ml = amounts[id] || 0;
    const pigment = PIGMENTS[id];
    const wrap = document.createElement('div');
    wrap.className = 'measure-cylinder';
    wrap.dataset.color = id;
    const tube = document.createElement('div');
    tube.className = 'measure-cylinder-tube';
    const fill = document.createElement('div');
    fill.className = 'measure-cylinder-fill';
    fill.style.height = `${ml}%`;
    fill.style.background = pigmentColor(id);
    tube.appendChild(fill);
    const label = document.createElement('div');
    label.className = 'measure-cylinder-label';
    label.textContent = `${pigment.emoji} ${ml}ml`;
    wrap.appendChild(tube);
    wrap.appendChild(label);
    measureAreaEl.appendChild(wrap);
  });
}

function renderBeaker() {
  const total = totalVolume();
  const pct = Math.min(100, (total / BEAKER_MAX) * 100);
  beakerLiquidEl.style.height = `${pct}%`;
  beakerVolumeEl.textContent = `${total} / ${BEAKER_MAX} ml`;

  beakerLayersEl.innerHTML = '';
  if (baseMix) {
    const baseBand = document.createElement('div');
    baseBand.className = 'beaker-layer';
    baseBand.style.height = `${(baseMix.volume / total) * 100}%`;
    baseBand.style.background = `rgb(${baseMix.rgb.join(', ')})`;
    beakerLayersEl.appendChild(baseBand);
  }
  freshOrder.forEach((id) => {
    const ml = freshAmounts[id];
    if (!ml) return;
    const band = document.createElement('div');
    band.className = 'beaker-layer';
    band.style.height = `${(ml / total) * 100}%`;
    band.style.background = pigmentColor(id);
    beakerLayersEl.appendChild(band);
  });

  const mixed = total > 0 ? mixColors(amounts) : null;
  beakerMixedEl.style.background = mixed ? `rgb(${mixed.join(', ')})` : 'transparent';

  beakerLayersEl.classList.toggle('hide', isMixed);
  beakerMixedEl.classList.toggle('show', isMixed);

  if (total > 0) {
    beakerRatioEl.textContent = Object.entries(amounts)
      .filter(([, ml]) => ml > 0)
      .map(([id, ml]) => `${Math.round((ml / total) * 100)}% ${PIGMENTS[id].name}`)
      .join(' • ');
  } else {
    beakerRatioEl.textContent = '';
  }
}

function spawnBubbles() {
  const wrap = document.getElementById('beakerBubbles');
  wrap.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const b = document.createElement('span');
    b.className = 'beaker-bubble';
    b.style.left = `${10 + Math.random() * 80}%`;
    b.style.animationDelay = `${Math.random() * 0.4}s`;
    wrap.appendChild(b);
  }
  setTimeout(() => { wrap.innerHTML = ''; }, 1000);
}

function animatePourDrop(id, startRect, onArrive) {
  const beakerRect = beakerEl.getBoundingClientRect();
  if (!startRect || typeof Element.prototype.animate !== 'function') {
    onArrive();
    return;
  }

  const drop = document.createElement('div');
  drop.className = 'pour-drop';
  drop.style.background = pigmentColor(id);
  document.body.appendChild(drop);

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top;
  const endX = beakerRect.left + beakerRect.width / 2;
  const endY = beakerRect.top + beakerRect.height * 0.3;
  const dx = endX - startX;
  const dy = endY - startY;

  drop.style.left = `${startX}px`;
  drop.style.top = `${startY}px`;

  const anim = drop.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.9)', opacity: 1, offset: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 35}px)) scale(1.05)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.7, offset: 1 },
    ],
    { duration: 420, easing: 'ease-in' },
  );

  anim.onfinish = () => {
    drop.remove();
    onArrive();
  };
}

function pourColor(id, btnEl) {
  const total = totalVolume();
  if (total >= BEAKER_MAX) {
    flashFeedback('⚠️ Bình đã đầy (100ml)! Hãy đổ hết trước khi pha tiếp.', false);
    return;
  }
  const add = Math.min(POUR_STEP, BEAKER_MAX - total);
  amounts[id] = (amounts[id] || 0) + add;
  if (!pourOrder.includes(id)) pourOrder.push(id);
  freshAmounts[id] = (freshAmounts[id] || 0) + add;
  if (!freshOrder.includes(id)) freshOrder.push(id);
  isMixed = false;
  renderMeasure();
  audioManager.playTone(300, 0.08, 'sine', 0, 0.1);

  if (btnEl) {
    btnEl.classList.add('pour-bounce');
    setTimeout(() => btnEl.classList.remove('pour-bounce'), 350);
  }

  const cylinderTube = measureAreaEl.querySelector(`.measure-cylinder[data-color="${id}"] .measure-cylinder-tube`);
  const startRect = (cylinderTube || btnEl)?.getBoundingClientRect();
  animatePourDrop(id, startRect, () => {
    renderBeaker();
    spawnBubbles();
    audioManager.playTone(190, 0.1, 'sine', 0, 0.12);
    audioManager.playTone(140, 0.16, 'sine', 0.06, 0.1);
  });
}

function resetBeaker() {
  amounts = {};
  pourOrder = [];
  baseMix = null;
  freshAmounts = {};
  freshOrder = [];
  isMixed = false;
  renderBeaker();
  renderMeasure();
}

btnResetBeaker.addEventListener('click', () => {
  resetBeaker();
  audioManager.playTone(180, 0.2, 'sine', 0, 0.08);
});

btnStir.addEventListener('click', () => {
  const total = totalVolume();
  if (total <= 0) {
    flashFeedback('⚠️ Hãy đổ màu vào bình trước đã!', false);
    return;
  }
  beakerEl.classList.add('stirring');
  stirRodEl.classList.add('active');
  spawnBubbles();
  audioManager.playTone(260, 0.15, 'sine', 0, 0.08);
  audioManager.playTone(320, 0.15, 'sine', 0.15, 0.08);
  audioManager.playTone(260, 0.15, 'sine', 0.3, 0.08);
  setTimeout(() => {
    beakerEl.classList.remove('stirring');
    stirRodEl.classList.remove('active');
    const mixed = mixColors(amounts);
    if (mixed) {
      baseMix = { rgb: mixed, volume: totalVolume() };
    }
    freshAmounts = {};
    freshOrder = [];
    isMixed = true;
    renderBeaker();
    if (mixed) {
      const discovered = tryDiscover(mixed);
      if (discovered) {
        showToast({
          title: '🎉 Bạn vừa khám phá:',
          swatchStyle: `rgb(${discovered.rgb.join(', ')})`,
          swatchText: '',
          name: discovered.name,
        });
        checkTierUnlock();
        checkAchievements();
      }
    }
  }, 900);
});

btnCheck.addEventListener('click', () => {
  const mixed = mixColors(amounts);
  if (!mixed) {
    flashFeedback('⚠️ Bình đang trống, hãy pha màu trước!', false);
    return;
  }
  const dist = colorDistance(mixed, currentTarget.rgb);
  const accuracy = accuracyFromDistance(dist);
  const stars = starsForAccuracy(accuracy);
  if (stars >= 1) {
    labState.stats.missionsCompleted += 1;
    if (stars === 3) labState.stats.perfectCount += 1;
    saveColorLabState(labState);
    const discovered = tryDiscover(mixed);
    checkTierUnlock();
    checkAchievements();
    showResult(stars, accuracy, discovered);
  } else {
    flashFeedback(`❌ Chưa đúng lắm (độ chính xác ${Math.round(accuracy)}%). Thử điều chỉnh tỉ lệ rồi kiểm tra lại nhé!`, false);
  }
});

// ---------- Missions ----------
function randomRatioMix(colorIds) {
  const n = colorIds.length;
  let remaining = BEAKER_MAX;
  const parts = [];
  for (let i = 0; i < n - 1; i++) {
    const maxPart = remaining - POUR_STEP * (n - 1 - i);
    const minPart = POUR_STEP;
    const steps = Math.max(0, Math.floor((maxPart - minPart) / POUR_STEP)) + 1;
    const part = minPart + POUR_STEP * randomInt(0, steps - 1);
    parts.push(part);
    remaining -= part;
  }
  parts.push(remaining);
  const mix = {};
  colorIds.forEach((id, idx) => { mix[id] = parts[idx]; });
  return mix;
}

function generateCreateMission() {
  const unlocked = unlockedColorIds();
  const n = unlocked.length >= 3 && Math.random() < 0.3 ? 3 : 2;
  const chosen = shuffleArray(unlocked).slice(0, Math.min(n, unlocked.length));
  const recipeAmounts = randomRatioMix(chosen);
  const rgb = mixColors(recipeAmounts);
  return { type: 'create', rgb };
}

function generateObjectMission(isMystery) {
  const obj = pickRandom(OBJECT_TARGETS);
  return { type: isMystery ? 'mystery' : 'object', rgb: obj.rgb, emoji: obj.emoji, name: obj.name };
}

function generateMission() {
  if (currentMode === 'create') currentTarget = generateCreateMission();
  else if (currentMode === 'object') currentTarget = generateObjectMission(false);
  else if (currentMode === 'mystery') currentTarget = generateObjectMission(true);
  renderMission();
}

function renderMission() {
  missionTargetEl.innerHTML = '';
  if (currentMode === 'create') {
    missionLabelEl.textContent = '🎯 Hãy pha đúng màu này:';
    const swatch = document.createElement('div');
    swatch.className = 'game7-target-swatch';
    swatch.style.background = `rgb(${currentTarget.rgb.join(', ')})`;
    missionTargetEl.appendChild(swatch);
  } else if (currentMode === 'object') {
    missionLabelEl.textContent = `🍊 Hãy pha màu của ${currentTarget.name}!`;
    const emoji = document.createElement('div');
    emoji.className = 'game7-target-emoji';
    emoji.textContent = currentTarget.emoji;
    missionTargetEl.appendChild(emoji);
  } else if (currentMode === 'mystery') {
    missionLabelEl.textContent = '❓ Quan sát và tự suy luận xem cần pha màu gì!';
    const emoji = document.createElement('div');
    emoji.className = 'game7-target-emoji mystery';
    emoji.textContent = currentTarget.emoji;
    missionTargetEl.appendChild(emoji);
  }
}

function showResult(stars, accuracy, discovered) {
  resultTitleEl.textContent = stars === 3 ? '🎉 Xuất sắc!' : stars === 2 ? '✨ Rất tốt!' : '👍 Đạt yêu cầu!';
  resultStarsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = `game7-star${i < stars ? ' filled' : ''}`;
    s.textContent = '⭐';
    resultStarsEl.appendChild(s);
  }
  let detail = `Độ chính xác màu: ${Math.round(accuracy)}%`;
  if (discovered) detail += ` — Bạn vừa khám phá màu mới: ${discovered.name}!`;
  resultDetailEl.textContent = detail;
  audioManager.playVictory();
  resultModal.classList.remove('hidden');
}

resultNext.addEventListener('click', () => {
  resultModal.classList.add('hidden');
  resetBeaker();
  generateMission();
});

resultRetry.addEventListener('click', () => {
  resultModal.classList.add('hidden');
  resetBeaker();
});

// ---------- Color Book / Achievements ----------
function renderColorBookList() {
  colorBookListEl.innerHTML = '';
  if (labState.colorBook.length === 0) {
    colorBookListEl.innerHTML = '<p class="game7-empty">Chưa khám phá màu nào. Hãy pha và nhấn 🌀 Khuấy để khám phá màu mới!</p>';
    return;
  }
  [...labState.colorBook].reverse().forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'colorbook-entry';
    const swatch = document.createElement('div');
    swatch.className = 'colorbook-swatch';
    swatch.style.background = `rgb(${entry.rgb.join(', ')})`;
    const info = document.createElement('div');
    info.className = 'colorbook-info';
    const name = document.createElement('div');
    name.className = 'colorbook-name';
    name.textContent = entry.name;
    const recipe = document.createElement('div');
    recipe.className = 'colorbook-recipe';
    recipe.textContent = entry.recipe.map((r) => `${r.ml}ml ${PIGMENTS[r.id].name}`).join(' + ');
    info.appendChild(name);
    info.appendChild(recipe);
    card.appendChild(swatch);
    card.appendChild(info);
    colorBookListEl.appendChild(card);
  });
}

btnColorBook.addEventListener('click', () => {
  renderColorBookList();
  colorBookModal.classList.remove('hidden');
});
closeColorBook.addEventListener('click', () => colorBookModal.classList.add('hidden'));

function renderAchievementsList() {
  achievementsListEl.innerHTML = '';
  Object.entries(ACHIEVEMENTS).forEach(([key, ach]) => {
    const unlocked = !!labState.achievements[key];
    const item = document.createElement('div');
    item.className = `achievement-item${unlocked ? ' unlocked' : ' locked'}`;
    item.innerHTML = `<span class="achievement-icon">${unlocked ? ach.icon : '🔒'}</span><span class="achievement-text"><strong>${ach.name}</strong><br>${ach.desc}</span>`;
    achievementsListEl.appendChild(item);
  });
}

btnAchievements.addEventListener('click', () => {
  renderAchievementsList();
  achievementsModal.classList.remove('hidden');
});
closeAchievements.addEventListener('click', () => achievementsModal.classList.add('hidden'));

// ---------- Paint & Draw ----------
function paintRegion(el) {
  const mixed = mixColors(amounts);
  if (!mixed) {
    flashFeedback('🎨 Hãy pha màu trong bình trước khi tô nhé!', false);
    return;
  }
  const color = `rgb(${mixed.join(', ')})`;
  if (el.classList && el.classList.contains('rainbow-ring')) {
    el.style.borderTopColor = color;
    el.style.borderLeftColor = color;
    el.style.borderRightColor = color;
  } else {
    el.setAttribute('fill', color);
  }
  audioManager.playTone(440, 0.08, 'triangle', 0, 0.1);
}

function selectPaintPicture(key) {
  paintCanvasWrapEl.innerHTML = PAINT_PICTURES[key].build();
  paintCanvasWrapEl.classList.remove('hidden');
  paintCanvasWrapEl.querySelectorAll('[data-region]').forEach((el) => {
    el.addEventListener('click', () => paintRegion(el));
  });
}

function renderPaintPicker() {
  paintPickerEl.innerHTML = '';
  Object.entries(PAINT_PICTURES).forEach(([key, pic]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'paint-thumb';
    btn.textContent = pic.label;
    btn.addEventListener('click', () => selectPaintPicture(key));
    paintPickerEl.appendChild(btn);
  });
}

// ---------- Mode selection ----------
const MODE_NAMES = { sandbox: 'Sandbox', create: 'Tạo màu này', object: 'Tìm màu đồ vật', mystery: 'Màu bí ẩn', paint: 'Tô tranh' };

function renderModeLocks() {
  const desc = paintModeCard.querySelector('.game7-mode-desc');
  if (labState.tier < 2) {
    paintModeCard.classList.add('locked');
    desc.textContent = `🔒 Khám phá ${TIER_REQUIREMENTS[2]} màu để mở khóa`;
  } else {
    paintModeCard.classList.remove('locked');
    desc.textContent = 'Tự pha màu rồi tô tranh thật đẹp';
  }
}

function setMode(mode) {
  currentMode = mode;
  modeSelectScreen.classList.add('hidden');
  labScreen.classList.remove('hidden');
  modeLabelEl.textContent = MODE_NAMES[mode];
  resetBeaker();
  workspaceEl.classList.remove('hidden');
  if (mode === 'sandbox') {
    missionPanel.classList.add('hidden');
    btnCheck.classList.add('hidden');
    paintPanel.classList.add('hidden');
  } else if (mode === 'paint') {
    missionPanel.classList.add('hidden');
    btnCheck.classList.add('hidden');
    paintPanel.classList.remove('hidden');
    paintCanvasWrapEl.classList.add('hidden');
    renderPaintPicker();
  } else {
    missionPanel.classList.remove('hidden');
    btnCheck.classList.remove('hidden');
    paintPanel.classList.add('hidden');
    generateMission();
  }
}

document.querySelectorAll('.game7-mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'paint' && labState.tier < 2) {
      window.alert(`🔒 Chế độ Tô Tranh cần mở khóa (khám phá thêm ${Math.max(0, TIER_REQUIREMENTS[2] - labState.colorBook.length)} màu nữa).`);
      return;
    }
    setMode(mode);
  });
});

btnModeSelect.addEventListener('click', () => {
  labScreen.classList.add('hidden');
  modeSelectScreen.classList.remove('hidden');
});

// ---------- Init ----------
renderShelf();
renderMeasure();
renderBeaker();
renderModeLocks();
discoveredEl.textContent = labState.colorBook.length;
