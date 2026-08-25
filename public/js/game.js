import { CHEST_ICON, ITEM_ICON, START_NODE, END_NODE, VIEWBOX, edgeKey, generateRandomMap } from './mapData.js';
import { loadGameState, saveGameState, clearGameState, loadSettings, saveSettings } from './storage.js';
import { fetchQuestions } from './api.js';
import { audioManager } from './audio.js';

const svg = document.getElementById('mapSvg');
const questionsValue = document.getElementById('questionsValue');
const toast = document.getElementById('toast');
const btnRestart = document.getElementById('btnRestart');
const btnMusicToggle = document.getElementById('btnMusicToggle');

const quizModal = document.getElementById('quizModal');
const quizQuestion = document.getElementById('quizQuestion');
const quizOptions = document.getElementById('quizOptions');
const quizMatching = document.getElementById('quizMatching');
const matchLeftCol = document.getElementById('matchLeftCol');
const matchRightCol = document.getElementById('matchRightCol');
const matchLinesSvg = document.getElementById('matchLinesSvg');
const quizResult = document.getElementById('quizResult');

const stuckModal = document.getElementById('stuckModal');
const stuckRestart = document.getElementById('stuckRestart');

const winModal = document.getElementById('winModal');
const winRestart = document.getElementById('winRestart');

const SVG_NS = 'http://www.w3.org/2000/svg';

let questions = [];
let state = null;
let busy = false; // blocks movement while a quiz/animation is in progress (FR-05)
let activeAttempt = null; // { edge, node, item }
let answered = false; // guards against picking a second option while grading

function totalItems() {
  return Object.keys(state.map.nodeItems).length;
}

function shuffleArray(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function defaultState(map) {
  const edgeStatus = {};
  map.edges.forEach((e) => {
    edgeStatus[edgeKey(e.from, e.to)] = 'normal';
  });
  return {
    map,
    currentNode: START_NODE,
    completedNodes: [],
    edgeStatus,
  };
}

function isStateCompatible(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!candidate.map || !candidate.map.nodes || !candidate.map.edges || !candidate.map.nodeItems) return false;
  if (!candidate.edgeStatus || !candidate.currentNode || !candidate.map.nodes[candidate.currentNode]) return false;
  return candidate.map.edges.every((e) =>
    Object.prototype.hasOwnProperty.call(candidate.edgeStatus, edgeKey(e.from, e.to))
  );
}

function initState() {
  const saved = loadGameState();
  if (isStateCompatible(saved)) {
    state = saved;
  } else {
    state = defaultState(generateRandomMap(questions));
  }
}

function persist() {
  saveGameState(state);
}

function showToast(message, duration = 2200) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), duration);
}

function outgoingEdges(node) {
  return state.map.edges.filter((e) => e.from === node);
}

// BFS over non-locked edges to detect a soft-lock (no way left to reach END).
function isReachable(fromNode) {
  const visited = new Set([fromNode]);
  const queue = [fromNode];
  while (queue.length) {
    const node = queue.shift();
    if (node === END_NODE) return true;
    for (const e of state.map.edges) {
      if (e.from === node && state.edgeStatus[edgeKey(e.from, e.to)] !== 'locked' && !visited.has(e.to)) {
        visited.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return visited.has(END_NODE);
}

function buildSvg() {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`);

  const edgeLayer = document.createElementNS(SVG_NS, 'g');
  const nodeLayer = document.createElementNS(SVG_NS, 'g');
  const itemLayer = document.createElementNS(SVG_NS, 'g');
  const playerLayer = document.createElementNS(SVG_NS, 'g');
  // itemLayer is drawn after nodeLayer so fruit/chest icons sit on top of node circles.
  svg.append(edgeLayer, nodeLayer, itemLayer, playerLayer);

  const { nodes, edges, nodeItems } = state.map;

  edges.forEach((e) => {
    const from = nodes[e.from];
    const to = nodes[e.to];
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    line.dataset.key = edgeKey(e.from, e.to);
    edgeLayer.appendChild(line);
  });

  Object.entries(nodes).forEach(([name, pos]) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'node-group');
    g.dataset.node = name;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 22);
    circle.setAttribute('class', 'node-circle');

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y - 32);
    label.setAttribute('class', 'node-label');
    label.textContent = pos.label || name;

    g.append(circle, label);
    g.addEventListener('click', () => onNodeClick(name));
    nodeLayer.appendChild(g);

    if (name === END_NODE) {
      const chest = document.createElementNS(SVG_NS, 'text');
      chest.setAttribute('x', pos.x);
      chest.setAttribute('y', pos.y);
      chest.setAttribute('class', 'chest-icon');
      chest.textContent = CHEST_ICON;
      itemLayer.appendChild(chest);
    } else if (nodeItems[name]) {
      const item = document.createElementNS(SVG_NS, 'text');
      item.setAttribute('x', pos.x);
      item.setAttribute('y', pos.y);
      item.setAttribute('class', 'item-icon');
      item.dataset.node = name;
      item.textContent = ITEM_ICON[nodeItems[name].type];
      itemLayer.appendChild(item);
    }
  });

  const pikachu = document.createElementNS(SVG_NS, 'g');
  pikachu.setAttribute('id', 'pikachu');
  pikachu.innerHTML = `
    <text class="crown-icon" x="0" y="-46" text-anchor="middle">👑</text>
    <g class="pikachu-body">
      <polygon points="-14,-24 -6,-42 -2,-22" class="pikachu-ear"></polygon>
      <polygon points="14,-24 6,-42 2,-22" class="pikachu-ear"></polygon>
      <circle cx="0" cy="0" r="18" class="pikachu-head"></circle>
      <circle cx="-9" cy="3" r="4" class="pikachu-cheek"></circle>
      <circle cx="9" cy="3" r="4" class="pikachu-cheek"></circle>
      <circle cx="-6" cy="-2" r="2" class="pikachu-eye"></circle>
      <circle cx="6" cy="-2" r="2" class="pikachu-eye"></circle>
    </g>
  `;
  playerLayer.appendChild(pikachu);
}

function renderEdges() {
  state.map.edges.forEach((e) => {
    const key = edgeKey(e.from, e.to);
    const line = svg.querySelector(`line[data-key="${CSS.escape(key)}"]`);
    const status = state.edgeStatus[key];
    line.setAttribute('class', `edge-line edge-${status}`);
  });

  Object.keys(state.map.nodeItems).forEach((nodeName) => {
    const itemEl = svg.querySelector(`.item-icon[data-node="${CSS.escape(nodeName)}"]`);
    if (itemEl) {
      itemEl.style.display = state.completedNodes.includes(nodeName) ? 'none' : '';
    }
  });
}

function renderNodes() {
  const reachableTargets = new Set(
    outgoingEdges(state.currentNode)
      .filter((e) => state.edgeStatus[edgeKey(e.from, e.to)] !== 'locked')
      .map((e) => e.to)
  );

  svg.querySelectorAll('.node-group').forEach((g) => {
    const name = g.dataset.node;
    g.classList.toggle('current', name === state.currentNode);
    g.classList.toggle('reachable', reachableTargets.has(name));
  });
}

function renderPlayer(animate) {
  const pos = state.map.nodes[state.currentNode];
  const pikachu = document.getElementById('pikachu');
  pikachu.style.transition = animate ? 'transform 0.6s ease-in-out' : 'none';
  pikachu.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
}

function renderHud() {
  questionsValue.textContent = `${state.completedNodes.length}/${totalItems()}`;
}

function renderAll(animatePlayer) {
  renderEdges();
  renderNodes();
  renderPlayer(animatePlayer);
  renderHud();
}

function onNodeClick(name) {
  if (busy) return;
  if (name === state.currentNode) return;
  const edge = outgoingEdges(state.currentNode).find((e) => e.to === name);
  if (!edge) {
    showToast('You cannot move there directly.');
    return;
  }
  const key = edgeKey(edge.from, edge.to);
  if (state.edgeStatus[key] === 'locked') {
    showToast('🔒 This road is locked. Choose another route.');
    return;
  }
  const item = state.map.nodeItems[name];
  const needsQuiz = item && !state.completedNodes.includes(name);
  if (needsQuiz) {
    openQuiz(edge, name, item);
  } else {
    moveTo(edge.to);
  }
}

function moveTo(target) {
  busy = true;
  state.currentNode = target;
  const pikachu = document.getElementById('pikachu');
  pikachu.classList.add('walking');
  renderAll(true);
  persist();
  setTimeout(() => {
    pikachu.classList.remove('walking');
    busy = false;
    if (state.currentNode === END_NODE) {
      showWin();
    } else if (!isReachable(state.currentNode)) {
      stuckModal.classList.remove('hidden');
    }
  }, 650);
}

function openQuiz(edge, node, item) {
  const q = questions.find((q) => q.id === item.questionId);
  if (!q) {
    showToast('⚠️ Question not found for this item.');
    return;
  }
  busy = true;
  activeAttempt = { edge, node, item };
  answered = false;
  quizQuestion.textContent = q.question;
  quizResult.classList.add('hidden');
  quizResult.textContent = '';

  if (q.type === 'matching') {
    quizOptions.classList.add('hidden');
    quizOptions.innerHTML = '';
    quizMatching.classList.remove('hidden');
    renderMatchingQuiz(q);
  } else {
    quizMatching.classList.add('hidden');
    matchLeftCol.innerHTML = '';
    matchRightCol.innerHTML = '';
    matchLinesSvg.innerHTML = '';
    quizOptions.classList.remove('hidden');
    renderMultipleChoiceQuiz(q);
  }

  quizModal.classList.remove('hidden');
}

function renderMultipleChoiceQuiz(q) {
  quizOptions.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      quizOptions.querySelectorAll('.quiz-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      gradeAnswer(idx === q.correctAnswer);
    });
    quizOptions.appendChild(btn);
  });
}

function renderMatchingQuiz(q) {
  matchLeftCol.innerHTML = '';
  matchRightCol.innerHTML = '';
  matchLinesSvg.innerHTML = '';

  const MAX_PER_LINE = 5;
  function formatItemDisplay(text) {
    const chars = Array.from(text);
    const lines = [];
    for (let i = 0; i < chars.length; i += MAX_PER_LINE) {
      lines.push(chars.slice(i, i + MAX_PER_LINE).join(''));
    }
    return lines.join('\n');
  }

  const rightOrder = shuffleArray(q.pairs.map((_, idx) => idx));
  let selectedLeft = null;
  let selectedRight = null;
  let matchedCount = 0;

  function sizeLinesSvg() {
    const rect = quizMatching.getBoundingClientRect();
    matchLinesSvg.setAttribute('width', rect.width);
    matchLinesSvg.setAttribute('height', rect.height);
    matchLinesSvg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  }

  function centerOf(el) {
    const elRect = el.getBoundingClientRect();
    const containerRect = quizMatching.getBoundingClientRect();
    return {
      x: elRect.left - containerRect.left + elRect.width / 2,
      y: elRect.top - containerRect.top + elRect.height / 2,
    };
  }

  function drawLine(leftEl, rightEl, status) {
    sizeLinesSvg();
    const start = centerOf(leftEl);
    const end = centerOf(rightEl);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.setAttribute('class', `match-line match-line-${status}`);
    matchLinesSvg.appendChild(line);
    return line;
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
      if (matchedCount === q.pairs.length) {
        answered = true;
        gradeAnswer(true);
      }
    } else {
      drawLine(selectedLeft.el, selectedRight.el, 'wrong');
      selectedLeft.el.classList.add('wrong-flash');
      selectedRight.el.classList.add('wrong-flash');
      answered = true;
      setTimeout(() => gradeAnswer(false), 400);
    }
  }

  q.pairs.forEach((pair, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-item';
    btn.textContent = formatItemDisplay(pair.left);
    btn.addEventListener('click', () => {
      if (answered) return;
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
    btn.className = 'match-item';
    btn.textContent = q.pairs[idx].right;
    btn.addEventListener('click', () => {
      if (answered) return;
      if (selectedRight) selectedRight.el.classList.remove('selected');
      btn.classList.add('selected');
      selectedRight = { idx, el: btn };
      tryMatch();
    });
    matchRightCol.appendChild(btn);
  });
}

function gradeAnswer(correct) {
  const { edge, node } = activeAttempt;
  const key = edgeKey(edge.from, edge.to);

  if (correct) {
    audioManager.playCorrect();
    quizResult.textContent = '✅ Correct Answer';
    quizResult.className = 'quiz-result quiz-correct';
    state.completedNodes.push(node);
    state.edgeStatus[key] = 'completed';
  } else {
    audioManager.playWrong();
    quizResult.textContent = '❌ Wrong Answer — Road Locked';
    quizResult.className = 'quiz-result quiz-wrong';
    state.edgeStatus[key] = 'locked';
  }
  quizResult.classList.remove('hidden');
  persist();
  renderAll(false);

  setTimeout(() => {
    quizModal.classList.add('hidden');
    const attempt = activeAttempt;
    activeAttempt = null;
    if (correct) {
      moveTo(attempt.edge.to);
    } else {
      busy = false;
      if (!isReachable(state.currentNode)) {
        stuckModal.classList.remove('hidden');
      }
    }
  }, 1400);
}

function showWin() {
  winModal.classList.remove('hidden');
  audioManager.playVictory();
  document.getElementById('pikachu').classList.add('victory');
}

function restartGame() {
  clearGameState();
  state = defaultState(generateRandomMap(questions));
  busy = false;
  activeAttempt = null;
  quizModal.classList.add('hidden');
  stuckModal.classList.add('hidden');
  winModal.classList.add('hidden');
  buildSvg();
  document.getElementById('pikachu').classList.remove('victory', 'walking');
  renderAll(false);
  persist();
}

btnRestart.addEventListener('click', () => {
  if (confirm('Restart the game? A new random map will be generated.')) {
    restartGame();
  }
});
stuckRestart.addEventListener('click', restartGame);
winRestart.addEventListener('click', restartGame);

const settings = loadSettings();
audioManager.setMusicOn(settings.musicOn);
btnMusicToggle.textContent = settings.musicOn ? '🔊' : '🔇';
btnMusicToggle.addEventListener('click', () => {
  settings.musicOn = !settings.musicOn;
  saveSettings(settings);
  audioManager.setMusicOn(settings.musicOn);
  btnMusicToggle.textContent = settings.musicOn ? '🔊' : '🔇';
});

async function init() {
  try {
    questions = await fetchQuestions();
  } catch (err) {
    showToast('⚠️ Could not load questions from server.');
    questions = [];
  }
  initState();
  buildSvg();
  renderAll(false);
  if (state.currentNode === END_NODE) {
    showWin();
  }
}

init();
