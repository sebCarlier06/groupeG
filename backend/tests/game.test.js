process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

jest.mock('mqtt', () => ({
  connect: () => ({
    on: jest.fn(),
    subscribe: jest.fn((topic, cb) => cb && cb(null)),
    publish: jest.fn(),
    end: jest.fn(),
  }),
}));

const request = require('supertest');
const { app } = require('../src/server');

let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'player1', password: 'gamepass' });
  token = res.body.token;
});

describe('Game — /api/game', () => {
  test('GET /scores — retourne un tableau', async () => {
    const res = await request(app).get('/api/game/scores');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /score — enregistre avec token valide', async () => {
    const res = await request(app)
      .post('/api/game/score')
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 70, survived_lanes: 5 });
    expect(res.status).toBe(201);
  });

  test('POST /score — score apparaît dans le classement', async () => {
    const res = await request(app).get('/api/game/scores');
    expect(res.body.some((s) => s.score === 70)).toBe(true);
  });

  test('POST /score — refusé sans token', async () => {
    const res = await request(app).post('/api/game/score').send({ score: 50 });
    expect(res.status).toBe(401);
  });

  test('POST /score — refusé si score manquant', async () => {
    const res = await request(app)
      .post('/api/game/score')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /events — retourne un tableau', async () => {
    const res = await request(app).get('/api/game/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/health — retourne ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
