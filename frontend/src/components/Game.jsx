import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { saveScore, getScores } from '../services/api';

const COLS     = 14;   // largeur du monde (zone jouable étendue)
const COLS_VIS = 10;   // colonnes visibles à l'écran (canvas = 600 px)
const ROWS     = 9;
const CELL     = 60;

const CHICK_VISUAL_ROW = Math.floor(ROWS * 0.75); // row 6 — décor dessous

// Bandes latérales fixes (toujours visibles)
const SIDE_SAFE_W  = 32; // forêt sur les zones safe
const SIDE_ROAD_W  = 14; // glissière sur les voies

const FENCE_W  = 8;
const EASE     = 0.13;
const SPEED_START = 0.45;
const SPEED_MAX   = 3.0;

const CAR_COLORS = [
  '#e74c3c','#c0392b','#3498db','#2980b9',
  '#f39c12','#d35400','#9b59b6','#1abc9c',
  '#e67e22','#27ae60',
];

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

function makeLane(idx) {
  if (idx === 0)      return { type: 'grass', cars: [] };
  if (idx % 5 === 0) return { type: 'safe',  cars: [] };

  const dir     = Math.random() < 0.5 ? 1 : -1;
  const n       = Math.floor(Math.random() * 3) + 1;
  const spacing = COLS_VIS / n;   // espacement sur la zone visible
  const cars    = [];

  for (let i = 0; i < n; i++) {
    const base = i * spacing + spacing * 0.1;
    const x    = base + Math.random() * spacing * 0.55;
    cars.push({
      id:    `${idx}-${i}-${Math.random().toString(36).slice(2)}`,
      x:     dir === 1 ? x : COLS_VIS - x,
      width: 1.5 + Math.random() * 1.2,
      speed: 0.018 + Math.random() * 0.024,
      dir,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    });
  }
  return { type: 'road', cars };
}

function getLane(map, idx) {
  if (!map.has(idx)) map.set(idx, makeLane(idx));
  return map.get(idx);
}

function speedMult(score) {
  return Math.min(SPEED_START + score * 0.013, SPEED_MAX);
}

function makeGame() {
  const lanes = new Map();
  lanes.set(0, { type: 'grass', cars: [] });
  return {
    laneIdx:  0,
    chickCol: COLS / 2,
    cameraY:  0,
    cameraX:  COLS / 2,
    lanes,
    status: 'playing',
    score:  0,
  };
}

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

function hash(n) { return Math.abs(((n * 1664525 + 1013904223) | 0)); }

export default function Game({ token, username, onLogout }) {
  const canvasRef    = useRef(null);
  const gameRef      = useRef(null);
  const animRef      = useRef(null);
  const socketRef    = useRef(null);
  const moveUpRef    = useRef(null);
  const moveDownRef  = useRef(null);
  const moveLeftRef  = useRef(null);
  const moveRightRef = useRef(null);
  const resetGameRef = useRef(null);

  const [status,      setStatus]      = useState('playing');
  const [score,       setScore]       = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  const loadLeaderboard = useCallback(async () => {
    try { setLeaderboard(await getScores()); } catch { /* ignore */ }
  }, []);

  const resetGame = useCallback(() => {
    gameRef.current = makeGame();
    setStatus('playing');
    setScore(0);
    if (socketRef.current) socketRef.current.emit('game_reset');
  }, []);

  const moveUp = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.laneIdx += 1;
    g.score = Math.max(g.score, g.laneIdx);
    setScore(g.score);
  }, []);

  const moveDown = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.laneIdx = Math.max(0, g.laneIdx - 1);
  }, []);

  const moveLeft = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.chickCol = Math.max(0, g.chickCol - 1);
  }, []);

  const moveRight = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.chickCol = Math.min(COLS - 1, g.chickCol + 1);
  }, []);

  useEffect(() => { moveUpRef.current    = moveUp;    }, [moveUp]);
  useEffect(() => { moveDownRef.current  = moveDown;  }, [moveDown]);
  useEffect(() => { moveLeftRef.current  = moveLeft;  }, [moveLeft]);
  useEffect(() => { moveRightRef.current = moveRight; }, [moveRight]);
  useEffect(() => { resetGameRef.current = resetGame; }, [resetGame]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('button_press', (data) => {
      if (gameRef.current?.status === 'dead') { resetGameRef.current?.(); return; }
      const dir = data?.direction || 'up';
      if      (dir === 'up')    moveUpRef.current?.();
      else if (dir === 'down')  moveDownRef.current?.();
      else if (dir === 'left')  moveLeftRef.current?.();
      else if (dir === 'right') moveRightRef.current?.();
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    gameRef.current = makeGame();
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;   // COLS_VIS * CELL = 600
    const H = canvas.height;

    const draw = () => {
      const g = gameRef.current;
      if (!g) { animRef.current = requestAnimationFrame(draw); return; }

      // ── Caméra fluide ──────────────────────────────────────────
      g.cameraY += (g.laneIdx  - g.cameraY) * EASE;
      g.cameraX += (g.chickCol - g.cameraX) * EASE;
      if (Math.abs(g.laneIdx  - g.cameraY) < 0.001) g.cameraY = g.laneIdx;
      if (Math.abs(g.chickCol - g.cameraX) < 0.001) g.cameraX = g.chickCol;

      const mult   = speedMult(g.score);
      const visMin = Math.floor(g.cameraY) - (ROWS - CHICK_VISUAL_ROW) - 1;
      const visMax = Math.floor(g.cameraY) + CHICK_VISUAL_ROW + 2;

      // monde → écran  (centré sur COLS_VIS/2)
      const laneVY  = (idx) => Math.round((CHICK_VISUAL_ROW - (idx - g.cameraY)) * CELL);
      const worldVX = (wx)  => (wx - g.cameraX + COLS_VIS / 2) * CELL;

      // ── Déplacement voitures ───────────────────────────────────
      for (let idx = visMin; idx <= visMax; idx++) {
        const lane = getLane(g.lanes, idx);
        for (const car of lane.cars) {
          car.x += car.speed * car.dir * mult;
          const wr = g.cameraX + COLS_VIS / 2 + 2;
          const wl = g.cameraX - COLS_VIS / 2 - 2;
          if (car.x > wr + car.width) car.x = wl - car.width;
          if (car.x < wl - car.width) car.x = wr + car.width;
        }
      }

      // ── Collision ──────────────────────────────────────────────
      const chickLane = getLane(g.lanes, g.laneIdx);
      if (g.status === 'playing' && chickLane.type === 'road') {
        for (const car of chickLane.cars) {
          if (car.x < g.chickCol + 0.65 && car.x + car.width > g.chickCol + 0.35) {
            g.status = 'dead';
            setStatus('dead');
            if (socketRef.current) socketRef.current.emit('game_over');
            saveScore(token, g.score, g.score).then(loadLeaderboard);
            break;
          }
        }
      }

      // ── Rendu lanes ────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      for (let idx = visMin; idx <= visMax; idx++) {
        const lane = getLane(g.lanes, idx);
        const vy   = laneVY(idx);
        if (vy > H + CELL || vy < -CELL) continue;

        // Fond
        if (lane.type === 'grass') {
          ctx.fillStyle = '#2ecc71';
        } else if (lane.type === 'safe') {
          ctx.fillStyle = '#a0845c';
        } else {
          ctx.fillStyle = idx % 2 === 0 ? '#555' : '#4a4a4a';
        }
        ctx.fillRect(0, vy, W, CELL);

        // Tirets de route
        if (lane.type === 'road') {
          const above = getLane(g.lanes, idx + 1);
          if (above.type === 'road') {
            ctx.setLineDash([14, 14]);
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(SIDE_ROAD_W, vy);
            ctx.lineTo(W - SIDE_ROAD_W, vy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Labels
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (lane.type === 'grass') {
          ctx.fillStyle = '#00000055';
          ctx.fillText('DÉPART', SIDE_ROAD_W + 8, vy + CELL / 2);
        } else if (lane.type === 'safe') {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText('🛡️  ZONE SAFE', SIDE_SAFE_W + 8, vy + CELL / 2);
        }

        // Voitures
        for (const car of lane.cars) {
          const cx = worldVX(car.x);
          const cy = vy + 6;
          const cw = car.width * CELL - 4;
          const ch = CELL - 12;
          if (cx + cw < -10 || cx > W + 10) continue;

          ctx.fillStyle = car.color;
          roundRect(ctx, cx + 2, cy, cw, ch, 6);
          ctx.fill();

          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(cx + 8,         cy + 6, cw * 0.28, ch - 10);
          ctx.fillRect(cx + cw * 0.52, cy + 6, cw * 0.28, ch - 10);

          ctx.font = '22px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(car.dir === 1 ? '🚗' : '🚙', cx + cw / 2 + 2, cy + ch / 2 + 1);
        }

        // ── Décorations latérales fixes (dessinées SUR les voitures) ──
        if (lane.type === 'safe') {
          // Forêt sur les zones safe — toujours visible, montre la limite lat.
          ctx.fillStyle = '#1a5c2a';
          ctx.fillRect(0, vy, SIDE_SAFE_W, CELL);
          ctx.fillRect(W - SIDE_SAFE_W, vy, SIDE_SAFE_W, CELL);
          // Arbres
          const h1 = hash(idx * 7 + 1);
          const h2 = hash(idx * 7 + 5);
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.font = `${20 + (h1 & 8)}px serif`;
          ctx.fillText('🌲', SIDE_SAFE_W / 2,     vy + CELL / 2);
          ctx.font = `${20 + (h2 & 8)}px serif`;
          ctx.fillText('🌲', W - SIDE_SAFE_W / 2, vy + CELL / 2);

        } else if (lane.type === 'road') {
          // Glissière de sécurité — les voitures émergent de derrière
          // Fond béton
          ctx.fillStyle = '#7a7a7a';
          ctx.fillRect(0,          vy + 10, SIDE_ROAD_W,     CELL - 20);
          ctx.fillRect(W - SIDE_ROAD_W, vy + 10, SIDE_ROAD_W, CELL - 20);
          // Ligne réfléchissante jaune au milieu
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(0,          vy + CELL / 2 - 3, SIDE_ROAD_W,     6);
          ctx.fillRect(W - SIDE_ROAD_W, vy + CELL / 2 - 3, SIDE_ROAD_W, 6);
          // Bord supérieur
          ctx.fillStyle = '#999';
          ctx.fillRect(0,          vy + 10, SIDE_ROAD_W,     3);
          ctx.fillRect(W - SIDE_ROAD_W, vy + 10, SIDE_ROAD_W, 3);
        }
      }

      // ── Poulet ─────────────────────────────────────────────────
      const chickVX = worldVX(g.chickCol);
      ctx.font = `${CELL - 6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        g.status === 'dead' ? '💀' : '🐔',
        chickVX + CELL / 2,
        CHICK_VISUAL_ROW * CELL + CELL - 2,
      );

      // ── Forêt monde (limites réelles col 0 et col COLS) ────────
      const roadL   = Math.round(worldVX(0));
      const roadR   = Math.round(worldVX(COLS));
      const railOff = (g.cameraY % 1) * CELL;

      function drawForestStrip(x0, x1) {
        if (x1 <= x0) return;
        const sw = x1 - x0;
        ctx.fillStyle = '#1a5c2a';
        ctx.fillRect(x0, 0, sw, H);
        if (sw >= 14) {
          ctx.textBaseline = 'alphabetic';
          for (let idx = visMin; idx <= visMax; idx++) {
            const vy = laneVY(idx);
            if (vy > H + CELL || vy < -CELL) continue;
            const h1 = hash(idx * 3 + (x0 < W / 2 ? 1 : 7));
            const h2 = hash(idx * 3 + (x0 < W / 2 ? 2 : 8));
            for (let t = 0; t < 2; t++) {
              const ht  = t === 0 ? h1 : h2;
              const tx  = x0 + 6 + (ht & 15) / 16 * Math.max(0, sw - 14);
              const ty  = vy + CELL * 0.1 + ((ht >> 4) & 31) / 32 * CELL * 0.65;
              const sz  = 18 + (ht & 10);
              ctx.font  = `${sz}px serif`;
              ctx.textAlign = 'center';
              ctx.fillText('🌲', tx, ty + sz);
            }
          }
        }
      }

      function drawFence(fx) {
        ctx.fillStyle = '#6b3a2a';
        ctx.fillRect(fx - FENCE_W / 2, 0, FENCE_W, H);
        ctx.fillStyle = '#8B5a3a';
        for (let y = -railOff; y < H + CELL; y += CELL * 0.45) {
          ctx.fillRect(fx - FENCE_W - 4, Math.round(y) + 4, FENCE_W * 2 + 8, 5);
        }
        ctx.fillStyle = '#5a2e14';
        for (let y = -railOff; y < H + CELL; y += CELL) {
          ctx.fillRect(fx - FENCE_W / 2 - 2, Math.round(y), FENCE_W + 4, 12);
        }
      }

      if (roadL > 0) { drawForestStrip(0, roadL); drawFence(roadL); }
      if (roadR < W) { drawForestStrip(roadR, W); drawFence(roadR); }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [token, loadLeaderboard]);

  const mult     = speedMult(gameRef.current?.score ?? 0);
  const speedPct = Math.round((mult / SPEED_MAX) * 100);

  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', color: '#fff', padding: 20, display: 'flex', gap: 28, justifyContent: 'center', alignItems: 'flex-start' }}>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: COLS_VIS * CELL, marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>🐔 Chicken Road</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span>Distance : <strong>{score}</strong></span>
            <span style={{ color: '#aaa', fontSize: 14 }}>{username}</span>
            <button onClick={onLogout} style={{ padding: '4px 12px', borderRadius: 4, background: '#ffffff20', color: '#fff', border: '1px solid #ffffff30', cursor: 'pointer' }}>
              Déconnexion
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={COLS_VIS * CELL}
          height={ROWS * CELL}
          style={{ border: '2px solid rgba(255,255,255,0.15)', borderRadius: 8, display: 'block' }}
        />

        <div style={{ width: COLS_VIS * CELL, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginBottom: 4 }}>
            <span>Vitesse des voitures</span>
            <span style={{ color: speedPct > 70 ? '#e74c3c' : speedPct > 40 ? '#f39c12' : '#2ecc71' }}>
              {speedPct}%
            </span>
          </div>
          <div style={{ height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${speedPct}%`,
              background: speedPct > 70 ? '#e74c3c' : speedPct > 40 ? '#f39c12' : '#2ecc71',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button onClick={moveUp}    disabled={status !== 'playing'} style={btnStyle(status)}>⬆️</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={moveLeft}  disabled={status !== 'playing'} style={btnStyle(status)}>⬅️</button>
            <button onClick={moveDown}  disabled={status !== 'playing'} style={btnStyle(status)}>⬇️</button>
            <button onClick={moveRight} disabled={status !== 'playing'} style={btnStyle(status)}>➡️</button>
          </div>
        </div>

        {status === 'dead' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 22, margin: '0 0 12px' }}>
              💀 Écrasé ! Distance : <strong>{score}</strong>
            </p>
            <button onClick={resetGame} style={{ padding: '10px 32px', fontSize: 16, borderRadius: 6, background: '#e74c3c', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Recommencer
            </button>
            <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
              ou appuie sur n'importe quel bouton physique
            </p>
          </div>
        )}
      </div>

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
          🔌 WebSocket · 📡 Pico<br />
          GPIO 0↔ 1→ 2↓ 14↑
        </p>
      </div>
    </div>
  );
}

function btnStyle(status) {
  return {
    width: 52, height: 52, fontSize: 22, borderRadius: 8,
    background: status === 'playing' ? '#2c3e50' : '#1a1a2e',
    border: '1px solid #ffffff20', color: '#fff',
    cursor: status === 'playing' ? 'pointer' : 'default',
  };
}
