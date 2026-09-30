import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

// Same "4 colorful animal cards" answer pattern used across the other mini
// games so the UI feels consistent.
const ANSWER_ANIMALS = ['🐤', '🐸', '🐘', '🐻'];
const ANSWER_COLORS = ['card-green', 'card-red', 'card-purple', 'card-orange'];
const BLANK_COLORS = ['blank-yellow', 'blank-green', 'blank-pink'];

const MAX_VALUE = 9; // keep every number in the equation smaller than 10
const NUM_ROUNDS = 8;
const NUM_OPTIONS = 4;

const boardEl = document.getElementById('game6EquationBoard');
const optionsWrap = document.getElementById('game6Options');
const feedbackEl = document.getElementById('game6Feedback');
const progressEl = document.getElementById('game6Progress');
const btnRestart = document.getElementById('btnRestart6');
const btnMusicToggle = document.getElementById('btnMusicToggle6');
const winModal = document.getElementById('win6Modal');
const winRestart = document.getElementById('win6Restart');

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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function shuffleArray(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRound() {
  const op = pickRandom(['+', '-']);
  let a;
  let b;
  let result;

  if (op === '+') {
    a = randomInt(1, MAX_VALUE - 1);
    b = randomInt(1, MAX_VALUE - a);
    result = a + b;
  } else {
    a = randomInt(1, MAX_VALUE);
    b = randomInt(0, a);
    result = a - b;
  }

  const hiddenPos = pickRandom(['a', 'b', 'result']);
  const correct = hiddenPos === 'a' ? a : hiddenPos === 'b' ? b : result;
  const blankColor = pickRandom(BLANK_COLORS);

  return { op, a, b, result, hiddenPos, correct, blankColor };
}

function generateOptions(correct) {
  const candidates = new Set();
  const near = shuffleArray([
    correct - 1,
    correct + 1,
    correct - 2,
    correct + 2,
    correct - 3,
    correct + 3,
  ].filter((n) => n >= 0 && n <= MAX_VALUE && n !== correct));

  near.forEach((n) => {
    if (candidates.size < NUM_OPTIONS - 1) candidates.add(n);
  });

  while (candidates.size < NUM_OPTIONS - 1) {
    const n = randomInt(0, MAX_VALUE);
    if (n !== correct) candidates.add(n);
  }

  return shuffleArray([correct, ...candidates]);
}

let round = 0;
let solved = 0;
let current = null;
let answered = false;
let blankEl = null;

function updateProgress() {
  progressEl.textContent = `${solved}/${NUM_ROUNDS}`;
}

function buildTerm(value, isBlank, blankColor) {
  const el = document.createElement('div');
  if (isBlank) {
    el.className = `equation-term equation-blank ${blankColor}`;
    el.textContent = '❓';
  } else {
    el.className = 'equation-term equation-number';
    el.textContent = value;
  }
  return el;
}

function buildOperator(symbol) {
  const el = document.createElement('span');
  el.className = 'equation-op';
  el.textContent = symbol;
  return el;
}

function renderQuestion() {
  current = generateRound();
  answered = false;
  feedbackEl.classList.add('hidden');
  feedbackEl.textContent = '';

  boardEl.innerHTML = '';
  blankEl = null;

  const termA = buildTerm(current.a, current.hiddenPos === 'a', current.blankColor);
  const termB = buildTerm(current.b, current.hiddenPos === 'b', current.blankColor);
  const termResult = buildTerm(current.result, current.hiddenPos === 'result', current.blankColor);

  if (current.hiddenPos === 'a') blankEl = termA;
  if (current.hiddenPos === 'b') blankEl = termB;
  if (current.hiddenPos === 'result') blankEl = termResult;

  boardEl.appendChild(termA);
  boardEl.appendChild(buildOperator(current.op));
  boardEl.appendChild(termB);
  boardEl.appendChild(buildOperator('='));
  boardEl.appendChild(termResult);

  const options = generateOptions(current.correct);
  optionsWrap.innerHTML = '';
  options.forEach((value, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `game6-option ${ANSWER_COLORS[idx % ANSWER_COLORS.length]}`;
    const animal = document.createElement('span');
    animal.className = 'game6-option-animal';
    animal.textContent = ANSWER_ANIMALS[idx % ANSWER_ANIMALS.length];
    const number = document.createElement('span');
    number.className = 'game6-option-number';
    number.textContent = value;
    btn.appendChild(animal);
    btn.appendChild(number);
    btn.addEventListener('click', () => selectOption(btn, value));
    optionsWrap.appendChild(btn);
  });
}

function selectOption(btn, value) {
  if (answered) return;
  const correct = value === current.correct;

  if (correct) {
    answered = true;
    btn.classList.add('correct-flash');
    blankEl.textContent = value;
    blankEl.classList.add('revealed');
    feedbackEl.textContent = '🎉 Chính xác!';
    feedbackEl.className = 'quiz-result quiz-correct';
    audioManager.playCorrect();
    optionsWrap.querySelectorAll('.game6-option').forEach((b) => {
      b.disabled = true;
    });
    solved += 1;
    updateProgress();

    setTimeout(() => {
      if (solved >= NUM_ROUNDS) {
        audioManager.playVictory();
        winModal.classList.remove('hidden');
      } else {
        round += 1;
        renderQuestion();
      }
    }, 2000);
  } else {
    btn.classList.add('wrong-flash');
    btn.disabled = true;
    const xMark = document.createElement('span');
    xMark.className = 'game6-option-x';
    xMark.textContent = '❌';
    btn.appendChild(xMark);
    feedbackEl.textContent = '❌ Chưa đúng, thử lại nhé!';
    feedbackEl.className = 'quiz-result quiz-wrong';
    audioManager.playWrong();
    setTimeout(() => {
      btn.classList.remove('wrong-flash');
    }, 500);
  }
}

function restartGame() {
  round = 0;
  solved = 0;
  winModal.classList.add('hidden');
  updateProgress();
  renderQuestion();
}

btnRestart.addEventListener('click', restartGame);
winRestart.addEventListener('click', restartGame);

restartGame();
