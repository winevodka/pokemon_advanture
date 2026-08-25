import { fetchQuestions, addQuestion, updateQuestion, deleteQuestion, importQuestions } from './api.js';

const form = document.getElementById('questionForm');
const formTitle = document.getElementById('formTitle');
const questionIdInput = document.getElementById('questionId');
const questionTypeSelect = document.getElementById('questionType');
const questionText = document.getElementById('questionText');
const multipleChoiceFields = document.getElementById('multipleChoiceFields');
const matchingFields = document.getElementById('matchingFields');
const optionInputs = Array.from(document.querySelectorAll('.optionInput'));
const correctAnswerSelect = document.getElementById('correctAnswer');
const pairLeftInputs = Array.from(document.querySelectorAll('.pairLeftInput'));
const pairRightInputs = Array.from(document.querySelectorAll('.pairRightInput'));
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const tableBody = document.getElementById('questionTableBody');
const importText = document.getElementById('importText');
const importBtn = document.getElementById('importBtn');
const importMessage = document.getElementById('importMessage');

let editingId = null;

function updateFieldVisibility() {
  const isMatching = questionTypeSelect.value === 'matching';
  multipleChoiceFields.classList.toggle('hidden', isMatching);
  matchingFields.classList.toggle('hidden', !isMatching);
}

questionTypeSelect.addEventListener('change', updateFieldVisibility);

function resetForm() {
  editingId = null;
  form.reset();
  questionIdInput.value = '';
  questionTypeSelect.value = 'multiple-choice';
  updateFieldVisibility();
  formTitle.textContent = 'Add Question';
  submitBtn.textContent = 'Add Question';
  cancelEditBtn.classList.add('hidden');
}

function renderTable(questions) {
  tableBody.innerHTML = '';
  questions.forEach((q) => {
    const tr = document.createElement('tr');

    const idTd = document.createElement('td');
    idTd.textContent = q.id;

    const typeTd = document.createElement('td');
    typeTd.textContent = q.type === 'matching' ? 'Matching' : 'Multiple Choice';

    const questionTd = document.createElement('td');
    questionTd.textContent = q.question;

    const optionsTd = document.createElement('td');
    const correctTd = document.createElement('td');
    if (q.type === 'matching') {
      optionsTd.textContent = q.pairs.map((p) => `${p.left} = ${p.right}`).join(', ');
      correctTd.textContent = '—';
    } else {
      optionsTd.textContent = q.options.join(', ');
      correctTd.textContent = q.options[q.correctAnswer];
    }

    const actionsTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEdit(q));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => onDelete(q.id));

    actionsTd.append(editBtn, deleteBtn);
    tr.append(idTd, typeTd, questionTd, optionsTd, correctTd, actionsTd);
    tableBody.appendChild(tr);
  });
}

async function refresh() {
  try {
    const questions = await fetchQuestions();
    renderTable(questions);
  } catch (err) {
    importMessage.textContent = `⚠️ ${err.message}`;
  }
}

function startEdit(q) {
  editingId = q.id;
  questionIdInput.value = q.id;
  questionText.value = q.question;
  questionTypeSelect.value = q.type === 'matching' ? 'matching' : 'multiple-choice';
  updateFieldVisibility();

  if (q.type === 'matching') {
    pairLeftInputs.forEach((input, idx) => {
      input.value = (q.pairs[idx] && q.pairs[idx].left) || '';
    });
    pairRightInputs.forEach((input, idx) => {
      input.value = (q.pairs[idx] && q.pairs[idx].right) || '';
    });
  } else {
    optionInputs.forEach((input, idx) => {
      input.value = q.options[idx] || '';
    });
    correctAnswerSelect.value = String(q.correctAnswer);
  }

  formTitle.textContent = `Edit Question #${q.id}`;
  submitBtn.textContent = 'Save Changes';
  cancelEditBtn.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelEditBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = questionTypeSelect.value;
  let payload;
  if (type === 'matching') {
    const pairs = pairLeftInputs
      .map((input, idx) => ({ left: input.value.trim(), right: pairRightInputs[idx].value.trim() }))
      .filter((p) => p.left.length > 0 && p.right.length > 0);
    payload = {
      type: 'matching',
      question: questionText.value.trim(),
      pairs,
    };
  } else {
    payload = {
      type: 'multiple-choice',
      question: questionText.value.trim(),
      options: optionInputs.map((input) => input.value.trim()),
      correctAnswer: Number(correctAnswerSelect.value),
    };
  }
  try {
    if (editingId) {
      await updateQuestion(editingId, payload);
    } else {
      await addQuestion(payload);
    }
    resetForm();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

async function onDelete(id) {
  if (!confirm(`Delete question #${id}?`)) return;
  try {
    await deleteQuestion(id);
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

importBtn.addEventListener('click', async () => {
  importMessage.textContent = '';
  let parsed;
  try {
    parsed = JSON.parse(importText.value);
  } catch {
    importMessage.textContent = '⚠️ Invalid JSON format.';
    return;
  }
  if (!Array.isArray(parsed)) {
    importMessage.textContent = '⚠️ JSON must be an array of questions.';
    return;
  }
  try {
    await importQuestions(parsed);
    importMessage.textContent = `✅ Imported ${parsed.length} question(s).`;
    importText.value = '';
    await refresh();
  } catch (err) {
    importMessage.textContent = `⚠️ ${err.message}`;
  }
});

resetForm();
refresh();
