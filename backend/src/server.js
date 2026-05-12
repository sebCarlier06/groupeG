const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { setSocketIo, sendCommand } = require('./mqtt');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const { swaggerUi, swaggerSpec } = require('./swagger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Statut du serveur
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Serveur opérationnel
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

io.on('connection', (socket) => {
  console.log('Client WebSocket connecté:', socket.id);
  socket.on('game_over', () => {
    sendCommand('ON');
    io.emit('led_command', { command: 'ON' });
  });
  socket.on('game_win', () => {
    sendCommand('WIN');
    io.emit('led_command', { command: 'WIN' });
  });
  socket.on('game_reset', () => {
    sendCommand('OFF');
    io.emit('led_command', { command: 'OFF' });
  });
  socket.on('disconnect', () => console.log('Client déconnecté:', socket.id));
});

/**
 * @swagger
 * /api/game/button:
 *   post:
 *     summary: Simule un appui bouton physique (bridge USB→HTTP)
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Événement transmis
 */
app.post('/api/game/button', (req, res) => {
  const direction = req.body?.direction || 'up';
  try {
    const db = require('./db');
    db.prepare('INSERT INTO button_events (event_type) VALUES (?)').run(`btn_${direction}`);
  } catch (e) {
    console.error('Erreur DB:', e.message);
  }
  io.emit('button_press', { direction, timestamp: Date.now() });
  res.json({ ok: true });
});

setSocketIo(io);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Backend sur le port ${PORT}`);
    console.log(`Swagger : http://localhost:${PORT}/api/docs`);
  });
}

module.exports = { app, server };
