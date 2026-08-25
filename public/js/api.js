const BASE = '/api/questions';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchQuestions() {
  const res = await fetch(BASE);
  return handle(res);
}

export async function addQuestion(question) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question),
  });
  return handle(res);
}

export async function updateQuestion(id, question) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question),
  });
  return handle(res);
}

export async function deleteQuestion(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  return handle(res);
}

export async function importQuestions(list) {
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  return handle(res);
}
