import React, { useState } from 'react';
import { login } from '../api/auth';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard'; // Giriş sonrası dashboard'a yönlendir
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px #0001', minWidth: 320 }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>KolaySipariş Giriş</h2>
        <div style={{ marginBottom: 16 }}>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 6, background: '#FF6B35', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16 }}>
          {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span>Hesabınız yok mu? </span>
          <button type="button" style={{ color: '#9b5de5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => navigate('/register')}>Kayıt Ol</button>
        </div>
      </form>
    </div>
  );
};

export default Login; 