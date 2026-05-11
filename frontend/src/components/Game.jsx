import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { saveScore, getScores } from '../services/api';

const COLS = 10;
const ROWS = 8;
const CELL = 60;
const CHICK_COL = 5;

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const INIT_CARS = [
  { id: 1, lane: 1, x: 0.5, width: 2, speed: 0.035, dir: 1,  color: '#e74c3c' },
  { id: 2, lane: 1, x: 6.5, width: 2, speed: 0.035, dir: 1,  color: '#c0392b' },
  { id: 3, lane: 2, x: 3,   width: 3, speed: 0.022, dir: -1, color: '#3498db' },
  { id: 4, lane: 3, x: 1,   width: 2, speed: 0.042, dir: 1,  color: '#f39c12' },
  { id: 5, lane: 3, x: 7,   width: 2, speed: 0.042, dir: 1,  color: '#d35400' },
  { id: 6, lane: 4, x: 4.5, width: 2, speed: 0.028, dir: -1, color: '#9b59b6' },
  { id: 7, lane: 5, x: 2,   width: 3, speed: 0.018, dir: 1,  color: '#1abc9c' },
  { id: 8, lane: 6, x: 0,   width: 2, speed: 0.052, dir: -1, color: '#e67e22' },
  { id: 9, lane: 6, x: 6.5, width: 2, speed: 0.052, dir: -1, color: '#d35400' },
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function Game({ token, username, onLogout }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const animRef = useRef(null);
  const socketRef = useRef(null);
  const moveUpRef = useRef(null);

  const [status, setStatus] = useState('playing');
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  const loadLeaderboard = useCallback(async () => {
    try { setLeaderboard(await getScores()); } catch { /* ignore fetch errors */ }
  }, []);

  const resetGame = useCallback(() => {
    gameRef.current = {
      chickY: ROWS - 1,
      cars: INIT_CARS.map((c) => ({ ...c })),
      status: 'playing',
      score: 0,
    };
    setStatus('playing');
    setScore(0);
    if (socketRef.current) socketRef.current.emit('game_reset');
  }, []);

  const moveUp = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.chickY = Math.max(0, g.chickY - 1);
    const s = (ROWS - 1 - g.chickY) * 10;
    g.score = s;
    setScore(s);
    if (g.chickY === 0) {
      g.status = 'win';
      setStatus('win');
      if (socketRef.current) socketRef.current.emit('game_win');
      saveScore(token, s, ROWS - 1).then(loadLeaderboard);
    }
  }, [token, loadLeaderboard]);

  // Always expose latest moveUp via ref (avoids reconnecting socket on each render)
  useEffect(() => { moveUpRef.current = moveUp; }, [moveUp]);

  // Socket.io — connect once
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('button_press', () => moveUpRef.current?.());
    return () => socket.disconnect();
  }, []);

  // Init game + load leaderboard
  useEffect(() => {
    gameRef.current = {
      chickY: ROWS - 1,
      cars: INIT_CARS.map((c) => ({ ...c })),
      status: 'playing',
      score: 0,
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const g = gameRef.current;
      if (!g) { animRef.current = requestAnimationFrame(draw); return; }

      // Move cars
      g.cars = g.cars.map((car) => {
        let nx = car.x + car.speed * car.dir;
        if (nx > COLS + 1) nx = -car.width - 1;
        if (nx < -car.width - 1) nx = COLS + 1;
        return { ...car, x: nx };
      });

      // Collision detection
      if (g.status === 'playing') {
        for (const car of g.cars) {
          if (
            car.lane === g.chickY &&
            car.x < CHICK_COL + 0.65 &&
            car.x + car.width > CHICK_COL + 0.35
          ) {
            g.status = 'dead';
            setStatus('dead');
            if (socketRef.current) socketRef.current.emit('game_over');
            saveScore(token, g.score, ROWS - 1 - g.chickY).then(loadLeaderboard);
            break;
          }
        }
      }

      // ─── Background ───
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let r = 0; r < ROWS; r++) {
        const isGrass = r === 0 || r === ROWS - 1;
        if (isGrass) {
          ctx.fillStyle = r === 0 ? '#27ae60' : '#2ecc71';
        } else {
          ctx.fillStyle = r % 2 === 0 ? '#555' : '#4a4a4a';
        }
        ctx.fillRect(0, r * CELL, canvas.width, CELL);
      }

      // Road markings
      ctx.setLineDash([14, 14]);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let r = 1; r < ROWS - 2; r++) {
        ctx.beginPath();
        ctx.moveTo(0, (r + 1) * CELL);
        ctx.lineTo(canvas.width, (r + 1) * CELL);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Finish line label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏁  ARRIVÉE', 8, CELL / 2);

      // Start label
      ctx.fillStyle = '#00000066';
      ctx.fillText('DÉPART', 8, (ROWS - 1) * CELL + CELL / 2);

      // ─── Cars ───
      for (const car of g.cars) {
        const cx = car.x * CELL;
        const cy = car.lane * CELL + 6;
        const cw = car.width * CELL - 4;
        const ch = CELL - 12;

        ctx.fillStyle = car.color;
        roundRect(ctx, cx + 2, cy, cw, ch, 6);
        ctx.fill();

        // Windshield tint
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(cx + 8, cy + 6, cw * 0.28, ch - 10);
        ctx.fillRect(cx + cw * 0.52, cy + 6, cw * 0.28, ch - 10);

        // Emoji
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(car.dir === 1 ? '🚗' : '🚙', cx + cw / 2 + 2, cy + ch / 2 + 1);
      }

      // ─── Chicken ───
      const chickPx = CHICK_COL * CELL;
      const chickPy = g.chickY * CELL;
      ctx.font = `${CELL - 6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        g.status === 'dead' ? '💀' : '🐔',
        chickPx + CELL / 2,
        chickPy + CELL - 2
      );

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [token, loadLeaderboard]);

  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', color: '#fff', padding: 20, display: 'flex', gap: 28, justifyContent: 'center', alignItems: 'flex-start' }}>

      {/* Game column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: COLS * CELL, marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>🐔 Chicken Road</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span>Score : <strong>{score}</strong></span>
            <span style={{ color: '#aaa', fontSize: 14 }}>{username}</span>
            <button onClick={onLogout} style={{ padding: '4px 12px', borderRadius: 4, background: '#ffffff20', color: '#fff', border: '1px solid #ffffff30', cursor: 'pointer' }}>
              Déconnexion
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ border: '2px solid rgba(255,255,255,0.15)', borderRadius: 8, display: 'block' }}
        />

        <p style={{ color: '#888', marginTop: 12, marginBottom: 6, fontSize: 13 }}>
          Appuie sur le bouton physique (Pico W) pour avancer — ou clique ci-dessous :
        </p>

        <button
          onClick={moveUp}
          disabled={status !== 'playing'}
          style={{
            padding: '14px 56px', fontSize: 20, borderRadius: 8,
            background: status === 'playing' ? '#27ae60' : '#555',
            color: '#fff', border: 'none', cursor: status === 'playing' ? 'pointer' : 'default',
            fontWeight: 'bold', transition: 'background 0.2s',
          }}
        >
          ⬆️ Avancer
        </button>

        {status === 'dead' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 22, margin: '0 0 12px' }}>💀 Écrasé ! Score final : <strong>{score}</strong></p>
            <button onClick={resetGame} style={{ padding: '10px 32px', fontSize: 16, borderRadius: 6, background: '#e74c3c', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Recommencer
            </button>
          </div>
        )}
        {status === 'win' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 22, margin: '0 0 12px' }}>🎉 Tu as traversé ! Score : <strong>{score}</strong></p>
            <button onClick={resetGame} style={{ padding: '10px 32px', fontSize: 16, borderRadius: 6, background: '#27ae60', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Rejouer
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{ minWidth: 220, paddingTop: 48 }}>
        <h3 style={{ margin: '0 0 16px' }}>🏆 Classement</h3>
        {leaderboard.length === 0 ? (
          <p style={{ color: '#666', fontSize: 14 }}>Aucun score pour l'instant.</p>
        ) : (
          leaderboard.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 14 }}>
              <span>{i + 1}. {s.username}</span>
              <strong>{s.score} pts</strong>
            </div>
          ))
        )}
        <p style={{ marginTop: 20, fontSize: 12, color: '#555' }}>
          🔌 Connecté via WebSocket<br />
          📡 MQTT topic : game/button/press
        </p>
      </div>
    </div>
  );
}
