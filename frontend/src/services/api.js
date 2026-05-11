const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function testBackend() {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
}

export async function sendMove(direction) {
  const res = await fetch(`${API_URL}/game/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ direction })
  });

  return res.json();
}