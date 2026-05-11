import { useEffect, useState } from "react";
import { sendMove, testBackend } from "./services/api";

function App() {
  const [status, setStatus] = useState("loading...");
  const [playerY, setPlayerY] = useState(4);

  useEffect(() => {
    testBackend()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("backend offline"));
  }, []);

  const moveForward = async () => {
    await sendMove("forward");
    setPlayerY((y) => Math.max(0, y - 1));
  };

  return (
    <main style={{ padding: 30 }}>
      <h1>IoT Crossy Road</h1>
      <p>Backend status : {status}</p>

      <div style={{ fontSize: 32, lineHeight: "42px" }}>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row}>
            {row === playerY ? "🐸 ⬛ ⬛ ⬛ ⬛" : "⬛ ⬛ ⬛ ⬛ ⬛"}
          </div>
        ))}
      </div>

      <button onClick={moveForward} style={{ marginTop: 20 }}>
        Avancer
      </button>
    </main>
  );
}

export default App;