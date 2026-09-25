import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

const ANIMAL_POOL = [
  { emoji: '🐟', name: 'Cá' },
  { emoji: '🐱', name: 'Mèo' },
  { emoji: '🐶', name: 'Chó' },
  { emoji: '🐴', name: 'Ngựa' },
  { emoji: '🐘', name: 'Voi' },
  { emoji: '🐰', name: 'Thỏ' },
  { emoji: '🐻', name: 'Gấu' },
  { emoji: '🐵', name: 'Khỉ' },
  { emoji: '🦊', name: 'Cáo' },
  { emoji: '🐼', name: 'Gấu trúc' },
];
const ANSWER_COLORS = ['card-green', 'card-red', 'card-purple', 'card-orange'];
const MAX_VALUE = 10;
const ASSIGNMENT_COUNT = 5;
const NUM_ROUNDS = 8;
const NUM_OPTIONS = 4;

const legendEl = document.getElementById('game5Legend');
const questionBoard = document.getElementById('game5QuestionBoard');
const optionsWrap = document.getElementById('game5Options');
const feedbackEl = document.getElementById('game5Feedback');
const progressEl = document.getElementById('game5Progress');
const btnRestart = document.getElementById('btnRestart5');
const btnMusicToggle = document.getElementById('btnMusicToggle5');
const winModal = document.getElementById('win5Modal');
const winRestart = document.getElementById('win5Restart');

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
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function pickDistinctValues(count, maxValue) {
  return shuffleArray(Array.from({ length: maxValue }, (_, index) => index + 1)).slice(0, count);
}

function buildAssignments() {
  const animals = shuffleArray(ANIMAL_POOL).slice(0, ASSIGNMENT_COUNT);
  const values = pickDistinctValues(ASSIGNMENT_COUNT, MAX_VALUE);
  return animals.map((animal, index) => ({ ...animal, value: values[index] }));
}

function buildEquations(assignments) {
  const equations = [];
  const animalByValue = new Map(assignments.map((animal) => [animal.value, animal]));

  assignments.forEach((leftAnimal) => {
    assignments.forEach((rightAnimal) => {
      const sum = leftAnimal.value + rightAnimal.value;
      if (animalByValue.has(sum)) {
        equations.push({ leftAnimal, rightAnimal, operator: '+', answerAnimal: animalByValue.get(sum) });
      }

      const difference = leftAnimal.value - rightAnimal.value;
      if (animalByValue.has(difference)) {
        equations.push({
          leftAnimal,
          rightAnimal,
          operator: '-',
          answerAnimal: animalByValue.get(difference),
        });
      }
    });
  });

  return equations;
}

function generateRound() {
  let assignments = [];
  let equations = [];

  while (equations.length === 0) {
    assignments = buildAssignments();
    equations = buildEquations(assignments);
  }

  const equation = pickRandom(equations);
  const distractors = shuffleArray(assignments.filter((animal) => animal.value !== equation.answerAnimal.value)).slice(0, NUM_OPTIONS - 1);
  const options = shuffleArray([equation.answerAnimal, ...distractors]);

  return {
    assignments,
    options,
    correctAnimal: equation.answerAnimal,
    leftAnimal: equation.leftAnimal,
    rightAnimal: equation.rightAnimal,
    operator: equation.operator,
  };
}

let solved = 0;
let current = null;
let answered = false;
let answerRevealEl = null;

function updateProgress() {
  progressEl.textContent = `${solved}/${NUM_ROUNDS}`;
}

function renderLegend(assignments) {
  legendEl.innerHTML = '';
  const orderedAssignments = [...assignments].sort((left, right) => left.value - right.value);

  orderedAssignments.forEach((animal) => {
    const card = document.createElement('div');
    card.className = 'animal-value-card';

    const emoji = document.createElement('span');
    emoji.className = 'animal-value-emoji';
    emoji.textContent = animal.emoji;

    const equals = document.createElement('span');
    equals.className = 'animal-value-equals';
    equals.textContent = '=';

    const value = document.createElement('span');
    value.className = 'animal-value-number';
    value.textContent = animal.value;

    card.appendChild(emoji);
    card.appendChild(equals);
    card.appendChild(value);
    legendEl.appendChild(card);
  });
}

function buildQuestionAnimal(animal, extraClass = '') {
  const card = document.createElement('div');
  card.className = `animal-math-card ${extraClass}`.trim();

  const emoji = document.createElement('span');
  emoji.className = 'animal-math-emoji';
  emoji.textContent = animal.emoji;

  card.appendChild(emoji);
  return card;
}

function renderQuestion() {
  current = generateRound();
  answered = false;
  answerRevealEl = null;
  feedbackEl.classList.add('hidden');
  feedbackEl.textContent = '';

  renderLegend(current.assignments);

  questionBoard.innerHTML = '';
  questionBoard.appendChild(buildQuestionAnimal(current.leftAnimal));

  const operator = document.createElement('span');
  operator.className = 'animal-math-operator';
  operator.textContent = current.operator;
  questionBoard.appendChild(operator);

  questionBoard.appendChild(buildQuestionAnimal(current.rightAnimal));

  const equals = document.createElement('span');
  equals.className = 'animal-math-operator';
  equals.textContent = '=';
  questionBoard.appendChild(equals);

  const answerCard = document.createElement('div');
  answerCard.className = 'animal-math-card animal-math-answer';
  answerRevealEl = document.createElement('span');
  answerRevealEl.className = 'animal-math-answer-mark';
  answerRevealEl.textContent = '❓';
  answerCard.appendChild(answerRevealEl);
  questionBoard.appendChild(answerCard);

  optionsWrap.innerHTML = '';
  current.options.forEach((animal, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `game5-option ${ANSWER_COLORS[index % ANSWER_COLORS.length]}`;

    const emoji = document.createElement('span');
    emoji.className = 'game5-option-emoji';
    emoji.textContent = animal.emoji;

    btn.appendChild(emoji);
    btn.addEventListener('click', () => selectOption(btn, animal));
    optionsWrap.appendChild(btn);
  });
}

function revealAnswer(animal) {
  answerRevealEl.textContent = animal.emoji;
  answerRevealEl.className = 'animal-math-answer-mark animal-math-answer-emoji';
  answerRevealEl.parentElement.classList.add('revealed');
}

function selectOption(btn, animal) {
  if (answered) return;

  const correct = animal.value === current.correctAnimal.value;
  if (correct) {
    answered = true;
    btn.classList.add('correct-flash');
    revealAnswer(animal);
    feedbackEl.textContent = '🎉 Chính xác!';
    feedbackEl.className = 'quiz-result quiz-correct';
    audioManager.playCorrect();
    optionsWrap.querySelectorAll('.game5-option').forEach((optionBtn) => {
      optionBtn.disabled = true;
    });
    solved += 1;
    updateProgress();

    setTimeout(() => {
      if (solved >= NUM_ROUNDS) {
        audioManager.playVictory();
        winModal.classList.remove('hidden');
      } else {
        renderQuestion();
      }
    }, 2000);
    return;
  }

  btn.classList.add('wrong-flash');
  btn.disabled = true;
  const xMark = document.createElement('span');
  xMark.className = 'game5-option-x';
  xMark.textContent = '❌';
  btn.appendChild(xMark);
  feedbackEl.textContent = '❌ Chưa đúng, thử lại nhé!';
  feedbackEl.className = 'quiz-result quiz-wrong';
  audioManager.playWrong();
  setTimeout(() => {
    btn.classList.remove('wrong-flash');
  }, 500);
}

function restartGame() {
  solved = 0;
  winModal.classList.add('hidden');
  updateProgress();
  renderQuestion();
}

btnRestart.addEventListener('click', restartGame);
winRestart.addEventListener('click', restartGame);

restartGame();