import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

// Item pool: fruits + everyday toys/school items (all generic emoji, no
// copyrighted character art) so the matching pairs feel varied.
const FRUITS = ['🍎', '🍊', '🍌', '🍇', '🍓', '🍑', '🍍', '🍉', '🥝', '🍒'];
const TOYS = ['🎾', '🪁', '🏸', '✏️', '🌸', '🎈', '🧸', '⚽', '🚗', '🎀'];
const ITEM_POOL = [...FRUITS, ...TOYS];

const NUM_PAIRS = 5;
const MAX_COUNT = 20;
const MAX_PER_LINE = 10;
const SVG_NS = 'http://www.w3.org/2000/svg';

const matchLeftCol = document.getElementById('matchLeftCol2');
const matchRightCol = document.getElementById('matchRightCol2');
const matchLinesSvg = document.getElementById('matchLinesSvg2');
const matchedValue = document.getElementById('matchedValue');
const board = document.querySelector('.match-game-board');
const btnRestart = document.getElementById('btnRestart');
const btnMusicToggle = document.getElementById('btnMusicToggle');
const winModal = document.getElementById('winModal2');
const winRestart = document.getElementById('winRestart2');

const settings = loadSettings();
audioManager.setMusicOn(settings.musicOn);
updateMusicIcon();

function updateMusicIcon() {
  btnMusicToggle.textContent = settings.musicOn ? '🔊' : '🔇';
}

btnMusicToggle.addEventListener('click', () => {
  settings.musicOn = !settings.musicOn;
  saveSettings(settings);
  audioManager.setMusicOn(settings.musicOn);
  updateMusicIcon();
});

function shuffleArray(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitGraphemes(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

function buildItemContent(text) {
  const wrap = document.createElement('span');
  wrap.className = 'match-item-content';
  const chars = splitGraphemes(text);
  for (let i = 0; i < chars.length; i += MAX_PER_LINE) {
    const row = document.createElement('span');
    row.className = 'match-row';
    row.textContent = chars.slice(i, i + MAX_PER_LINE).join('');
    wrap.appendChild(row);
  }
  return wrap;
}

let pairs = [];
let selectedLeft = null;
let selectedRight = null;
let matchedCount = 0;

function generateRound() {
  const counts = shuffleArray(Array.from({ length: MAX_COUNT }, (_, i) => i + 1)).slice(0, NUM_PAIRS);
  const items = shuffleArray(ITEM_POOL).slice(0, NUM_PAIRS);
  pairs = counts.map((count, i) => {
    return { left: items[i].repeat(count), right: String(count) };
  });
  matchedCount = 0;
  selectedLeft = null;
  selectedRight = null;
  winModal.classList.add('hidden');
  renderRound();
}

function sizeLinesSvg() {
  const rect = board.getBoundingClientRect();
  matchLinesSvg.setAttribute('width', rect.width);
  matchLinesSvg.setAttribute('height', rect.height);
  matchLinesSvg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
}

function edgePoint(el, side) {
  const elRect = el.getBoundingClientRect();
  const containerRect = board.getBoundingClientRect();
  const x = side === 'right' ? elRect.right - containerRect.left : elRect.left - containerRect.left;
  const y = elRect.top - containerRect.top + elRect.height / 2;
  return { x, y };
}

function drawLine(leftEl, rightEl, status) {
  sizeLinesSvg();
  const start = edgePoint(leftEl, 'right');
  const end = edgePoint(rightEl, 'left');
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', end.x);
  line.setAttribute('y2', end.y);
  line.setAttribute('class', `match-line match-line-${status}`);
  matchLinesSvg.appendChild(line);
  return line;
}

function updateProgress() {
  matchedValue.textContent = `${matchedCount}/${NUM_PAIRS}`;
}

function tryMatch() {
  if (!selectedLeft || !selectedRight) return;
  if (selectedLeft.idx === selectedRight.idx) {
    drawLine(selectedLeft.el, selectedRight.el, 'correct');
    selectedLeft.el.classList.remove('selected');
    selectedRight.el.classList.remove('selected');
    selectedLeft.el.classList.add('matched');
    selectedRight.el.classList.add('matched');
    selectedLeft.el.disabled = true;
    selectedRight.el.disabled = true;
    selectedLeft = null;
    selectedRight = null;
    matchedCount += 1;
    updateProgress();
    audioManager.playCorrect();
    if (matchedCount === NUM_PAIRS) {
      setTimeout(() => {
        audioManager.playVictory();
        winModal.classList.remove('hidden');
      }, 500);
    }
  } else {
    const line = drawLine(selectedLeft.el, selectedRight.el, 'wrong');
    const badLeft = selectedLeft.el;
    const badRight = selectedRight.el;
    badLeft.classList.add('wrong-flash');
    badRight.classList.add('wrong-flash');
    badLeft.disabled = true;
    badRight.disabled = true;
    audioManager.playWrong();
    selectedLeft = null;
    selectedRight = null;
    setTimeout(() => {
      badLeft.classList.remove('selected', 'wrong-flash');
      badRight.classList.remove('selected', 'wrong-flash');
      badLeft.disabled = false;
      badRight.disabled = false;
      line.remove();
    }, 500);
  }
}

function renderRound() {
  matchLeftCol.innerHTML = '';
  matchRightCol.innerHTML = '';
  matchLinesSvg.innerHTML = '';
  updateProgress();

  const rightOrder = shuffleArray(pairs.map((_, idx) => idx));

  pairs.forEach((pair, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-item';
    btn.appendChild(buildItemContent(pair.left));
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (selectedLeft) selectedLeft.el.classList.remove('selected');
      btn.classList.add('selected');
      selectedLeft = { idx, el: btn };
      tryMatch();
    });
    matchLeftCol.appendChild(btn);
  });

  rightOrder.forEach((idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-item match-item-number';
    btn.textContent = pairs[idx].right;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (selectedRight) selectedRight.el.classList.remove('selected');
      btn.classList.add('selected');
      selectedRight = { idx, el: btn };
      tryMatch();
    });
    matchRightCol.appendChild(btn);
  });
}

btnRestart.addEventListener('click', generateRound);
winRestart.addEventListener('click', generateRound);

generateRound();
