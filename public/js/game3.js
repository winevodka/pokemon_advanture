import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

// Cute fruit/animal emoji used to dress up the question + answer cards so the
// "find the missing number" drill feels playful for young kids.
const FRUIT_EMOJIS = ['🍎', '🍊', '🍑', '🍐', '🍇', '🍓', '🍉', '🍒', '🍋', '🍍'];
const ANSWER_ANIMALS = ['🐤', '🐸', '🐘', '🐻', '🐰', '🐱', '🐶', '🐼'];
const ANSWER_COLORS = ['card-green', 'card-red', 'card-purple', 'card-orange'];

const MAX_NUMBER = 20;
const NUM_ROUNDS = 8;
const NUM_OPTIONS = 4;
const SEQUENCE_LENGTH = 5;

const questionBoard = document.getElementById('game3QuestionBoard');
const optionsWrap = document.getElementById('game3Options');
const feedbackEl = document.getElementById('game3Feedback');
const progressEl = document.getElementById('game3Progress');
const btnRestart = document.getElementById('btnRestart3');
const btnMusicToggle = document.getElementById('btnMusicToggle3');
const winModal = document.getElementById('win3Modal');
const winRestart = document.getElementById('win3Restart');

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

function randomStart(step, parity) {
  const maxStart = MAX_NUMBER - (SEQUENCE_LENGTH - 1) * step;
  if (step === 1) {
    return randomInt(1, maxStart);
  }
  const first = parity === 'even' ? 2 : 1;
  const count = Math.floor((maxStart - first) / 2) + 1;
  return first + 2 * randomInt(0, count - 1);
}

function generateSequence() {
  const category = pickRandom(['consecutive', 'even', 'odd']);
  const step = category === 'consecutive' ? 1 : 2;
  const parity = category === 'even' ? 'even' : 'odd';
  const start = randomStart(step, parity);
  const numbers = Array.from({ length: SEQUENCE_LENGTH }, (_, i) => start + i * step);
  if (pickRandom(['asc', 'desc']) === 'desc') {
    numbers.reverse();
  }
  const mysteryIndex = randomInt(0, SEQUENCE_LENGTH - 1);
  return { numbers, mysteryIndex, correct: numbers[mysteryIndex] };
}

function generateOptions(correct) {
  const candidates = new Set();
  const near = [
    correct - 1,
    correct + 1,
    correct - 2,
    correct + 2,
    correct - 3,
    correct + 3,
  ].filter((n) => n >= 1 && n <= MAX_NUMBER && n !== correct);

  shuffleArray(near).forEach((n) => {
    if (candidates.size < NUM_OPTIONS - 1) candidates.add(n);
  });

  while (candidates.size < NUM_OPTIONS - 1) {
    const n = randomInt(1, MAX_NUMBER);
    if (n !== correct) candidates.add(n);
  }

  const options = shuffleArray([correct, ...candidates]);
  return options;
}

let round = 0;
let solved = 0;
let current = null;
let answered = false;
let mysteryNumberEl = null;
let mysteryCardEl = null;

function updateProgress() {
  progressEl.textContent = `${solved}/${NUM_ROUNDS}`;
}

function pickDistinctEmojis(count) {
  return shuffleArray(FRUIT_EMOJIS).slice(0, count);
}

function renderQuestion() {
  current = generateSequence();
  answered = false;
  feedbackEl.classList.add('hidden');
  feedbackEl.textContent = '';

  const emojis = pickDistinctEmojis(SEQUENCE_LENGTH);
  questionBoard.innerHTML = '';
  mysteryNumberEl = null;
  mysteryCardEl = null;

  current.numbers.forEach((num, idx) => {
    const card = document.createElement('div');
    card.className = 'fruit-card';
    const emoji = document.createElement('span');
    emoji.className = 'fruit-emoji';
    emoji.textContent = emojis[idx];
    const numberCircle = document.createElement('span');
    numberCircle.className = 'fruit-number-circle';

    if (idx === current.mysteryIndex) {
      card.classList.add('fruit-mystery');
      numberCircle.textContent = '❓';
      mysteryNumberEl = numberCircle;
      mysteryCardEl = card;
    } else {
      numberCircle.textContent = num;
    }

    card.appendChild(emoji);
    card.appendChild(numberCircle);
    questionBoard.appendChild(card);
  });

  const options = generateOptions(current.correct);
  optionsWrap.innerHTML = '';
  options.forEach((value, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `game3-option ${ANSWER_COLORS[idx % ANSWER_COLORS.length]}`;
    const animal = document.createElement('span');
    animal.className = 'game3-option-animal';
    animal.textContent = ANSWER_ANIMALS[idx % ANSWER_ANIMALS.length];
    const numberCircle = document.createElement('span');
    numberCircle.className = 'game3-option-number';
    numberCircle.textContent = value;
    const label = document.createElement('span');
    label.className = 'game3-option-label';
    label.textContent = 'Số';
    btn.appendChild(animal);
    btn.appendChild(numberCircle);
    btn.appendChild(label);
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
    mysteryNumberEl.textContent = value;
    mysteryCardEl.classList.add('revealed');
    feedbackEl.textContent = '🎉 Chính xác!';
    feedbackEl.className = 'quiz-result quiz-correct';
    audioManager.playCorrect();
    optionsWrap.querySelectorAll('.game3-option').forEach((b) => {
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
    xMark.className = 'game3-option-x';
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
