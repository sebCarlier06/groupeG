const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function register(username, password) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur inscription');
  return data;
}

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur connexion');
  return data;
}

export async function saveScore(token, score, survivedLanes) {
  if (!token) return;
  await fetch(`${BASE}/game/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ score, survived_lanes: survivedLanes }),
  });
}

export async function getScores() {
  const res = await fetch(`${BASE}/game/scores`);
  return res.json();
}
