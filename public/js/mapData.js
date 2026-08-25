export const VIEWBOX = { width: 730, height: 620 };

export const ITEM_ICON = {
  grape: '🍇',
  banana: '🍌',
  pineapple: '🍍',
};

// Displayed permanently at the END node to mark the destination reward.
export const CHEST_ICON = '🎁';

export const START_NODE = 'START';
export const END_NODE = 'END';

const ITEM_TYPES = ['grape', 'banana', 'pineapple'];

export function edgeKey(from, to) {
  return `${from}->${to}`;
}

function cloneNodes(nodes) {
  const clone = {};
  Object.entries(nodes).forEach(([key, value]) => {
    clone[key] = { ...value };
  });
  return clone;
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Several map layouts. A random one is picked for every new game/restart so
// each playthrough has a different route structure (FR-02). Every template
// guarantees >= 3 distinct START -> END routes with crossing, lockable paths.
const MAP_TEMPLATES = [
  {
    id: 'diamond',
    nodes: {
      START: { x: 60, y: 540, label: 'START' },
      A: { x: 230, y: 380, label: 'A' },
      D: { x: 230, y: 560, label: 'D' },
      C: { x: 420, y: 470, label: 'C' },
      B: { x: 420, y: 240, label: 'B' },
      E: { x: 580, y: 560, label: 'E' },
      END: { x: 660, y: 100, label: 'END' },
    },
    edges: [
      { from: 'START', to: 'A' },
      { from: 'START', to: 'D' },
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'D', to: 'C' },
      { from: 'D', to: 'E' },
      { from: 'C', to: 'B' },
      { from: 'C', to: 'E' },
      { from: 'B', to: 'END' },
      { from: 'E', to: 'END' },
    ],
  },
  {
    id: 'crossX',
    nodes: {
      START: { x: 60, y: 300, label: 'START' },
      A: { x: 240, y: 120, label: 'A' },
      B: { x: 240, y: 480, label: 'B' },
      C: { x: 420, y: 300, label: 'C' },
      D: { x: 600, y: 120, label: 'D' },
      E: { x: 600, y: 480, label: 'E' },
      END: { x: 700, y: 300, label: 'END' },
    },
    edges: [
      { from: 'START', to: 'A' },
      { from: 'START', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
      { from: 'A', to: 'E' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
      { from: 'C', to: 'E' },
      { from: 'D', to: 'END' },
      { from: 'E', to: 'END' },
    ],
  },
  {
    id: 'twinPeaks',
    nodes: {
      START: { x: 60, y: 500, label: 'START' },
      A: { x: 270, y: 560, label: 'A' },
      B: { x: 270, y: 300, label: 'B' },
      C: { x: 490, y: 560, label: 'C' },
      D: { x: 490, y: 300, label: 'D' },
      END: { x: 680, y: 150, label: 'END' },
    },
    edges: [
      { from: 'START', to: 'A' },
      { from: 'START', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'A', to: 'D' },
      { from: 'B', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'END' },
      { from: 'D', to: 'END' },
    ],
  },
];

// Builds one randomized playthrough: a random template with a random
// item (fruit + question) assigned to each intermediate node (FR-04).
export function generateRandomMap(questionPool) {
  const template = MAP_TEMPLATES[Math.floor(Math.random() * MAP_TEMPLATES.length)];
  const nodes = cloneNodes(template.nodes);
  const edges = template.edges.map((e) => ({ ...e }));
  const intermediateNodes = Object.keys(nodes).filter((n) => n !== START_NODE && n !== END_NODE);

  const shuffledNodeOrder = shuffle(intermediateNodes);
  const pool = Array.isArray(questionPool) ? questionPool : [];
  let shuffledQuestions = shuffle(pool);

  const nodeItems = {};
  shuffledNodeOrder.forEach((nodeName, idx) => {
    if (shuffledQuestions.length === 0) return; // no questions available in the bank
    if (idx > 0 && idx % shuffledQuestions.length === 0) {
      shuffledQuestions = shuffle(pool);
    }
    const question = shuffledQuestions[idx % shuffledQuestions.length];
    nodeItems[nodeName] = {
      type: ITEM_TYPES[idx % ITEM_TYPES.length],
      questionId: question.id,
    };
  });

  return { templateId: template.id, nodes, edges, nodeItems };
}
