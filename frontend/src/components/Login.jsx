import { useState } from 'react';
import { login, register } from '../services/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await login(username, password)
        : await register(username, password);
      onLogin(data.token, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: '#fff',
    }}>
      <div style={{ fontSize: 72, marginBottom: 8 }}>🐔</div>
      <h1 style={{ margin: '0 0 4px', fontSize: 32 }}>Chicken Road</h1>
      <p style={{ color: '#aaa', margin: '0 0 32px' }}>IoT × Raspberry Pi Pico W</p>

      <form onSubmit={submit} style={{
        display: 'flex', flexDirection: 'column', gap: 12, width: 300,
        background: '#ffffff10', padding: 32, borderRadius: 12,
        border: '1px solid #ffffff20',
      }}>
        <h2 style={{ margin: '0 0 8px', textAlign: 'center' }}>
          {mode === 'login' ? 'Connexion' : 'Inscription'}
        </h2>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nom d'utilisateur"
          required
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ffffff30', background: '#ffffff10', color: '#fff', fontSize: 15 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          required
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ffffff30', background: '#ffffff10', color: '#fff', fontSize: 15 }}
        />

        {error && (
          <p style={{ color: '#e74c3c', margin: 0, fontSize: 14, textAlign: 'center' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 12, background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
          style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 13 }}
        >
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  );
}
