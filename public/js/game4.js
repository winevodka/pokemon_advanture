import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

// Cute fruit emoji used for the "objects" style question side, and animal
// emoji used to decorate the comparison symbol answer buttons.
const FRUIT_EMOJIS = ['🍎', '🍊', '🍑', '🍐', '🍇', '🍓', '🍉', '🍒', '🍋', '🍍'];
const ANSWER_ANIMALS = ['🐤', '🐸', '🐘'];
const ANSWER_COLORS = ['card-green', 'card-red', 'card-purple'];
const SYMBOLS = ['>', '<', '='];

const MAX_VALUE = 10;
const NUM_ROUNDS = 8;
const MAX_PER_LINE = 5;

const questionBoard = document.getElementById('game4QuestionBoard');
const optionsWrap = document.getElementById('game4Options');
const feedbackEl = document.getElementById('game4Feedback');
const progressEl = document.getElementById('game4Progress');
const btnRestart = document.getElementById('btnRestart4');
const btnMusicToggle = document.getElementById('btnMusicToggle4');
const winModal = document.getElementById('win4Modal');
const winRestart = document.getElementById('win4Restart');

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

function splitGraphemes(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

function generateRound() {
  const leftType = pickRandom(['number', 'objects']);
  const rightType = pickRandom(['number', 'objects']);
  const leftValue = randomInt(1, MAX_VALUE);
  const rightValue = Math.random() < 0.3 ? leftValue : randomInt(1, MAX_VALUE);

  let leftEmoji = pickRandom(FRUIT_EMOJIS);
  let rightEmoji = pickRandom(FRUIT_EMOJIS);
  while (rightEmoji === leftEmoji) {
    rightEmoji = pickRandom(FRUIT_EMOJIS);
  }

  const correct = leftValue > rightValue ? '>' : leftValue < rightValue ? '<' : '=';
  return { leftType, rightType, leftValue, rightValue, leftEmoji, rightEmoji, correct };
}

function buildSideCard(type, value, emoji) {
  const card = document.createElement('div');
  card.className = 'compare-card';

  if (type === 'number') {
    const num = document.createElement('span');
    num.className = 'compare-number';
    num.textContent = value;
    card.appendChild(num);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'compare-objects';
    const chars = splitGraphemes(emoji.repeat(value));
    for (let i = 0; i < chars.length; i += MAX_PER_LINE) {
      const row = document.createElement('div');
      row.className = 'compare-row';
      row.textContent = chars.slice(i, i + MAX_PER_LINE).join('');
      wrap.appendChild(row);
    }
    card.appendChild(wrap);
  }

  return card;
}

let round = 0;
let solved = 0;
let current = null;
let answered = false;
let symbolEl = null;
let mysteryCardEl = null;

function updateProgress() {
  progressEl.textContent = `${solved}/${NUM_ROUNDS}`;
}

function renderQuestion() {
  current = generateRound();
  answered = false;
  feedbackEl.classList.add('hidden');
  feedbackEl.textContent = '';

  questionBoard.innerHTML = '';

  const leftCard = buildSideCard(current.leftType, current.leftValue, current.leftEmoji);
  questionBoard.appendChild(leftCard);

  mysteryCardEl = document.createElement('div');
  mysteryCardEl.className = 'compare-card compare-mystery';
  symbolEl = document.createElement('span');
  symbolEl.className = 'compare-symbol';
  symbolEl.textContent = '❓';
  mysteryCardEl.appendChild(symbolEl);
  questionBoard.appendChild(mysteryCardEl);

  const rightCard = buildSideCard(current.rightType, current.rightValue, current.rightEmoji);
  questionBoard.appendChild(rightCard);

  const symbols = shuffleArray(SYMBOLS);
  optionsWrap.innerHTML = '';
  symbols.forEach((symbol, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `game4-option ${ANSWER_COLORS[idx % ANSWER_COLORS.length]}`;
    const animal = document.createElement('span');
    animal.className = 'game4-option-animal';
    animal.textContent = ANSWER_ANIMALS[idx % ANSWER_ANIMALS.length];
    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'game4-option-symbol';
    symbolSpan.textContent = symbol;
    btn.appendChild(animal);
    btn.appendChild(symbolSpan);
    btn.addEventListener('click', () => selectOption(btn, symbol));
    optionsWrap.appendChild(btn);
  });
}

function selectOption(btn, symbol) {
  if (answered) return;
  const correct = symbol === current.correct;

  if (correct) {
    answered = true;
    btn.classList.add('correct-flash');
    symbolEl.textContent = symbol;
    mysteryCardEl.classList.add('revealed');
    feedbackEl.textContent = '🎉 Chính xác!';
    feedbackEl.className = 'quiz-result quiz-correct';
    audioManager.playCorrect();
    optionsWrap.querySelectorAll('.game4-option').forEach((b) => {
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
    xMark.className = 'game4-option-x';
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
