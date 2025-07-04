import React, { useState } from 'react';
import { register } from '../api/auth';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    if (!restaurantName.trim()) {
      setError('Lütfen işletme adını giriniz.');
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi giriniz.');
      setLoading(false);
      return;
    }
    if (!password.trim()) {
      setError('Lütfen şifrenizi giriniz.');
      setLoading(false);
      return;
    }
    try {
      await register(name, email, password, restaurantName);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px #0001', minWidth: 320 }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Kayıt Ol</h2>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Ad Soyad"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>
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
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="İşletme Adı"
            value={restaurantName}
            onChange={e => setRestaurantName(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 6, border: '1px solid #ddd', fontSize: 16 }}
            required
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 12, textAlign: 'center' }}>Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 6, background: '#9b5de5', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16 }}>
          {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
        </button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span>Zaten hesabınız var mı? </span>
          <button type="button" style={{ color: '#9b5de5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => navigate('/login')}>Giriş Yap</button>
        </div>
      </form>
    </div>
  );
};

export default Register; 