const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'questions.json');

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function readQuestions() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeQuestions(questions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(questions, null, 2), 'utf-8');
}

function validateQuestion(body) {
  if (!body || typeof body !== 'object') return 'Invalid question payload';
  if (typeof body.question !== 'string' || body.question.trim().length === 0) {
    return 'Question text is required';
  }
  if (body.question.length > 500) return 'Question text is too long';

  const type = body.type === 'matching' ? 'matching' : 'multiple-choice';

  if (type === 'matching') {
    if (!Array.isArray(body.pairs) || body.pairs.length < 2 || body.pairs.length > 6) {
      return 'Pairs must be an array of 2-6 items';
    }
    const valid = body.pairs.every(
      (p) =>
        p &&
        typeof p.left === 'string' &&
        p.left.trim().length > 0 &&
        p.left.length <= 100 &&
        typeof p.right === 'string' &&
        p.right.trim().length > 0 &&
        p.right.length <= 100
    );
    if (!valid) return 'Each pair must have non-empty left and right values (max 100 chars)';
    return null;
  }

  if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6) {
    return 'Options must be an array of 2-6 items';
  }
  if (!body.options.every((o) => typeof o === 'string' && o.trim().length > 0 && o.length <= 200)) {
    return 'Each option must be a non-empty string (max 200 chars)';
  }
  if (!Number.isInteger(body.correctAnswer) || body.correctAnswer < 0 || body.correctAnswer >= body.options.length) {
    return 'correctAnswer must be a valid option index';
  }
  return null;
}

// Builds the canonical stored shape for a question based on its type,
// stripping any unrelated fields from the request body.
function normalizeQuestion(id, body) {
  const type = body.type === 'matching' ? 'matching' : 'multiple-choice';
  if (type === 'matching') {
    return {
      id,
      type,
      question: body.question.trim(),
      pairs: body.pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })),
    };
  }
  return {
    id,
    type,
    question: body.question.trim(),
    options: body.options.map((o) => o.trim()),
    correctAnswer: body.correctAnswer,
  };
}

// GET all questions
app.get('/api/questions', (req, res) => {
  res.json(readQuestions());
});

// GET a single question
app.get('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  const question = readQuestions().find((q) => q.id === id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  res.json(question);
});

// CREATE a question
app.post('/api/questions', (req, res) => {
  const error = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });

  const questions = readQuestions();
  const nextId = questions.reduce((max, q) => Math.max(max, q.id), 0) + 1;
  const newQuestion = normalizeQuestion(nextId, req.body);
  questions.push(newQuestion);
  writeQuestions(questions);
  res.status(201).json(newQuestion);
});

// UPDATE a question
app.put('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  const error = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });

  const questions = readQuestions();
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  questions[idx] = normalizeQuestion(id, req.body);
  writeQuestions(questions);
  res.json(questions[idx]);
});

// DELETE a question
app.delete('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  const questions = readQuestions();
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  const [removed] = questions.splice(idx, 1);
  writeQuestions(questions);
  res.json(removed);
});

// IMPORT questions in bulk (appended to the existing bank)
app.post('/api/questions/import', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Payload must be a JSON array of questions' });
  }
  if (req.body.length > 500) {
    return res.status(400).json({ error: 'Too many questions in one import (max 500)' });
  }
  for (const item of req.body) {
    const error = validateQuestion(item);
    if (error) return res.status(400).json({ error: `Invalid question in import: ${error}` });
  }

  const questions = readQuestions();
  let nextId = questions.reduce((max, q) => Math.max(max, q.id), 0) + 1;
  const added = req.body.map((item) => normalizeQuestion(nextId++, item));
  const updated = questions.concat(added);
  writeQuestions(updated);
  res.status(201).json(updated);
});

app.listen(PORT, () => {
  console.log(`Pokemon Learning Adventure server running at http://localhost:${PORT}`);
});
