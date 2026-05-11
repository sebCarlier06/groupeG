const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/game/scores:
 *   get:
 *     summary: Top 10 du classement
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Liste des meilleurs scores
 */
router.get('/scores', (req, res) => {
  const scores = db.prepare(`
    SELECT s.score, s.survived_lanes, s.created_at, u.username
    FROM scores s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.score DESC
    LIMIT 10
  `).all();
  res.json(scores);
});

/**
 * @swagger
 * /api/game/score:
 *   post:
 *     summary: Enregistrer un score (authentification requise)
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score: { type: integer }
 *               survived_lanes: { type: integer }
 *     responses:
 *       201:
 *         description: Score enregistré
 *       401:
 *         description: Non authentifié
 */
router.post('/score', auth, (req, res) => {
  const { score, survived_lanes } = req.body;
  if (score === undefined) {
    return res.status(400).json({ error: 'score requis' });
  }
  db.prepare('INSERT INTO scores (user_id, score, survived_lanes) VALUES (?, ?, ?)')
    .run(req.user.id, score, survived_lanes || 0);
  res.status(201).json({ message: 'Score enregistré' });
});

/**
 * @swagger
 * /api/game/events:
 *   get:
 *     summary: 20 derniers appuis de bouton (IoT)
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Liste des événements bouton
 */
router.get('/events', (req, res) => {
  const events = db.prepare('SELECT * FROM button_events ORDER BY created_at DESC LIMIT 20').all();
  res.json(events);
});

module.exports = router;
