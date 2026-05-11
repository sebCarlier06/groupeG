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

describe('Auth — /api/auth', () => {
  test('register — crée un utilisateur et retourne un token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('alice');
  });

  test('register — nom déjà pris retourne 400', async () => {
    await request(app).post('/api/auth/register').send({ username: 'bob', password: 'pass' });
    const res = await request(app).post('/api/auth/register').send({ username: 'bob', password: 'pass' });
    expect(res.status).toBe(400);
  });

  test('register — champs manquants retourne 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'nopw' });
    expect(res.status).toBe(400);
  });

  test('login — identifiants corrects retourne un token', async () => {
    await request(app).post('/api/auth/register').send({ username: 'carol', password: 'secret' });
    const res = await request(app).post('/api/auth/login').send({ username: 'carol', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('login — mauvais mot de passe retourne 401', async () => {
    await request(app).post('/api/auth/register').send({ username: 'dave', password: 'correct' });
    const res = await request(app).post('/api/auth/login').send({ username: 'dave', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('login — utilisateur inexistant retourne 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'pass' });
    expect(res.status).toBe(401);
  });
});
