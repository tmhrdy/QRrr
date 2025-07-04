import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaGoogle, FaQrcode, FaPlus, FaChartBar, FaCommentDots } from 'react-icons/fa';
import './Dashboard.css';

const API_BASE = 'http://localhost:5002/api';

const shortcutCards = [
  {
    icon: <FaGoogle />, title: 'Google İşletme Profilini Bağla', desc: "İşletmeni Google'da öne çıkar.", btn: 'Bağlantı', color: '#f1f1fa',
    onClick: async (token: string, setLoading: any, setResult: any) => {
      setLoading('google');
      try {
        const res = await axios.post(`${API_BASE}/integrations/google`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setResult({ type: 'success', msg: 'Google entegrasyonu başarılı!' });
      } catch (e: any) {
        setResult({ type: 'error', msg: e?.response?.data?.message || 'Hata oluştu.' });
      } finally { setLoading(null); }
    }
  },
  {
    icon: <FaQrcode />, title: 'Dijital Menüyü Aktifleştir', desc: 'QR kodunu tarat, menünü yayına al.', btn: 'Detay', color: '#f1f1fa',
    onClick: async (token: string, setLoading: any, setResult: any) => {
      setLoading('menu');
      try {
        const res = await axios.post(`${API_BASE}/menus/activate`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setResult({ type: 'success', msg: 'Menü aktifleştirildi!' });
      } catch (e: any) {
        setResult({ type: 'error', msg: e?.response?.data?.message || 'Hata oluştu.' });
      } finally { setLoading(null); }
    }
  },
  {
    icon: <FaQrcode />, title: 'QR Kodunu Görüntüle', desc: 'Menünüzün QR kodunu indir.', btn: 'QR Kod', color: '#f1f1fa',
    onClick: async (token: string, setLoading: any, setResult: any) => {
      setLoading('qr');
      try {
        const res = await axios.get(`${API_BASE}/menus/qr`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        window.open(url, '_blank');
        setResult({ type: 'success', msg: 'QR kod açıldı.' });
      } catch (e: any) {
        setResult({ type: 'error', msg: e?.response?.data?.message || 'Hata oluştu.' });
      } finally { setLoading(null); }
    }
  },
  {
    icon: <FaPlus />, title: 'Yeni Ürün Ekle', desc: 'Menüne yeni ürün ekle.', btn: 'Ürün Ekle', color: '#f1f1fa',
    onClick: (token: string, setLoading: any, setResult: any, navigate: any) => {
      navigate('/urun-ekle');
    }
  },
  {
    icon: <FaChartBar />, title: 'Günlük Satış Raporunu Al', desc: 'Bugünkü satış raporunu indir.', btn: 'Raporu Al', color: '#f1f1fa',
    onClick: async (token: string, setLoading: any, setResult: any) => {
      setLoading('report');
      try {
        const res = await axios.get(`${API_BASE}/stats/daily`, { headers: { Authorization: `Bearer ${token}` } });
        setResult({ type: 'success', msg: `Bugünkü satış: ₺${res.data?.total || 0}` });
      } catch (e: any) {
        setResult({ type: 'error', msg: e?.response?.data?.message || 'Hata oluştu.' });
      } finally { setLoading(null); }
    }
  },
  {
    icon: <FaCommentDots />, title: 'Yorumları Görüntüle', desc: 'Müşteri yorumlarını incele.', btn: 'Yorumlar', color: '#f1f1fa',
    onClick: (token: string, setLoading: any, setResult: any, navigate: any) => {
      navigate('/yorumlar');
    }
  },
];

export default function Dashboard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{type: string, msg: string} | null>(null);
  const [summary, setSummary] = useState<any>({ sales: 0, orders: 0, comments: 0 });
  const [user, setUser] = useState<{name: string}>({ name: 'Kullanıcı' });
  const navigate = useNavigate();

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    // Kullanıcı adı ve özet verileri çek
    axios.get(`${API_BASE}/stats/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setSummary(res.data))
      .catch(() => {});
    axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser({ name: res.data?.first_name || 'Kullanıcı' }))
      .catch(() => {});
  }, []);

  const token = localStorage.getItem('token') || '';

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">KolaySipariş</div>
        <nav className="sidebar-nav">
          <a className="active" href="#">Anasayfa</a>
          <a href="#">Ürünler</a>
          <a href="#">Siparişler</a>
          <a href="#">Ayarlar</a>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-welcome">
            <h2>Hoş geldin, <span className="highlight">{user.name}</span> 👋</h2>
            <div className="dashboard-date">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </header>
        <section className="dashboard-stats-row" style={{marginBottom: 32}}>
          <div className="dashboard-stats-card">
            <div className="stats-icon"><FaChartBar /></div>
            <div className="stats-value">₺{summary.sales}</div>
            <div className="stats-label">Bugünkü Satış</div>
          </div>
          <div className="dashboard-stats-card">
            <div className="stats-icon"><FaQrcode /></div>
            <div className="stats-value">{summary.orders}</div>
            <div className="stats-label">Aktif Sipariş</div>
          </div>
          <div className="dashboard-stats-card">
            <div className="stats-icon"><FaCommentDots /></div>
            <div className="stats-value">{summary.comments}</div>
            <div className="stats-label">Yorum</div>
          </div>
        </section>
        <section className="dashboard-shortcut-row">
          {shortcutCards.map((card, i) => (
            <div className="dashboard-shortcut-card" key={i}>
              <div className="dashboard-shortcut-icon">{card.icon}</div>
              <div className="dashboard-shortcut-title">{card.title}</div>
              <div className="dashboard-shortcut-desc">{card.desc}</div>
              <button
                className="dashboard-shortcut-btn"
                disabled={loading && loading === card.btn.toLowerCase()}
                onClick={() => card.onClick(token, setLoading, setResult, navigate)}
              >
                {loading && loading === card.btn.toLowerCase() ? '...' : card.btn}
              </button>
            </div>
          ))}
        </section>
        {result && (
          <div style={{marginBottom: 16, color: result.type === 'success' ? '#2ecc40' : '#e74c3c', fontWeight: 600}}>
            {result.msg}
          </div>
        )}
      </main>
    </div>
  );
} 