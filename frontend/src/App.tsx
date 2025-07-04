import React, { useState, useRef } from "react";
import "./App.css";
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import Dashboard from './pages/Dashboard';

const PRIMARY_COLOR = "#9b5de5";
const ACCENT_COLOR = "#f3eaff";
const BUTTON_COLOR = "#9b5de5";
const BUTTON_TEXT = "#fff";
const BG_GRADIENT = "linear-gradient(120deg, #f7f7fb 60%, #f3eaff 100%)";

const menuConfig = [
  {
    label: "Solutions",
    dropdown: [
      "Dine-in QR Menu",
      "FineDine POS Lite",
      "Reservations",
      "Dine-in Tablet Menu",
      "Delivery & Pickup Menu",
      "Fast Checkout",
      "Order & Pay",
      "CRM & Loyalty",
    ],
  },
  {
    label: "Features",
    dropdown: [
      "Allergens Nutrition Info",
      "Multiple Language Display",
      "Multiple Currency Display",
      "Custom Design and Branding",
      "Tip Collection",
      "Table Management",
      "Feedback Collection",
      "Menu Management",
      "Campaigns",
    ],
  },
  {
    label: "Use Cases",
    dropdown: [
      "Hotels",
      "Café & Bakery",
      "Coffee Shops",
      "Bars and Night Clubs",
      "Enterprises",
      "Fine Dining",
      "Casual Dining",
      "Ghost Kitchens",
      "Food Trucks",
    ],
  },
  { label: "Pricing" },
  {
    label: "Resource Center",
    dropdown: [
      "Blog",
      "Case Studies",
      "Help Center",
      "FAQ",
      "Contact",
    ],
  },
];

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function App() {
  const [showCookie, setShowCookie] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navigate = useNavigate();

  // Dışarı tıklayınca dropdown kapansın
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        openDropdown &&
        !dropdownRefs.current.some(
          (ref) => ref && ref.contains(e.target as Node)
        )
      ) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [openDropdown]);

  return (
    <div style={{ minHeight: "100vh", background: BG_GRADIENT, fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      {/* Üst Menü Barı */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '28px 0 0 48px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
          {/* Logo */}
          <span style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 28, color: PRIMARY_COLOR, letterSpacing: 1, cursor: 'pointer', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: 2}}>
              <circle cx="16" cy="16" r="15" stroke={PRIMARY_COLOR} strokeWidth="2" fill="#fff" />
              <rect x="10" y="10" width="12" height="12" rx="3" fill={PRIMARY_COLOR} fillOpacity="0.15" />
              <rect x="14" y="14" width="4" height="4" rx="1.5" fill={PRIMARY_COLOR} />
            </svg>
            Kolay<span style={{color: '#e649f5'}}>Sipariş</span>
          </span>
        </div>
        <nav className="navbar-menu">
          {menuConfig.map((item, idx) => (
            <div
              key={item.label}
              style={{ position: 'relative', zIndex: openDropdown === item.label ? 100 : 1 }}
              ref={el => (dropdownRefs.current[idx] = el)}
            >
              <button
                className={"navbar-menu-btn" + (openDropdown === item.label ? " active" : "")}
                onClick={e => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === item.label ? null : item.label);
                }}
                onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
              >
                {item.label}
                {item.dropdown && (
                  <span style={{ marginLeft: 4, fontSize: 12 }}>▼</span>
                )}
              </button>
              {item.dropdown && openDropdown === item.label && (
                <div className="navbar-dropdown">
                  {item.dropdown.map((opt) => (
                    <a
                      key={opt}
                      href="#"
                      className="navbar-dropdown-link"
                      onClick={e => {
                        e.stopPropagation();
                        setOpenDropdown(null);
                      }}
                    >
                      {opt}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button
            className="navbar-menu-btn"
            style={{ marginLeft: 16, fontWeight: 600, fontSize: 16, background: 'none', border: 'none', color: PRIMARY_COLOR, cursor: 'pointer' }}
            onClick={() => navigate('/products')}
          >Products</button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', marginRight: 48 }}>
          <button 
            style={{ background: 'none', border: `2px solid ${PRIMARY_COLOR}`, color: PRIMARY_COLOR, borderRadius: 8, padding: '8px 22px', fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
            onClick={() => navigate('/login')}
          >Sign in</button>
          <button 
            style={{ background: PRIMARY_COLOR, color: BUTTON_TEXT, border: 'none', borderRadius: 8, padding: '8px 22px', fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'background 0.15s' }}
            onClick={() => navigate('/register')}
          >Get Started</button>
        </div>
      </header>
      {/* Router ile sayfa geçişleri */}
      <Routes>
        <Route path="/" element={
          // Ana içerik ve çerez bildirimi
          <>
            {/* Ana İçerik */}
            <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)', padding: '0 0 0 0' }}>
              <div style={{ flex: 1, maxWidth: 600, padding: '0 0 0 80px' }}>
                <div style={{ marginTop: 60 }}>
                  <span style={{ background: ACCENT_COLOR, color: PRIMARY_COLOR, fontWeight: 700, borderRadius: 16, padding: '4px 16px', fontSize: 14, marginBottom: 18, display: 'inline-block' }}>New Product</span>
                  <h1 style={{ fontSize: 44, fontWeight: 800, color: PRIMARY_COLOR, margin: '18px 0 18px 0', lineHeight: 1.1 }}>
                    Next-gen restaurant management platform at your fingertips
                  </h1>
                  <div style={{ fontSize: 20, color: '#2d1e4a', marginBottom: 36, fontWeight: 400 }}>
                    From speedy payments to smooth reservations, KolaySipariş is your all-in-one restaurant management solution.
                  </div>
                  <div style={{ display: 'flex', gap: 18 }}>
                    <button style={{ background: PRIMARY_COLOR, color: BUTTON_TEXT, border: 'none', borderRadius: 8, padding: '16px 32px', fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px 0 rgba(155,93,229,0.10)' }}>Start Your Trial</button>
                    <button style={{ background: 'none', border: `2px solid ${PRIMARY_COLOR}`, color: PRIMARY_COLOR, borderRadius: 8, padding: '16px 32px', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>Book a Demo</button>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ position: 'relative', width: 280, height: 340, background: 'linear-gradient(135deg, #f3eaff 60%, #fff 100%)', borderRadius: 32, boxShadow: '0 8px 32px 0 rgba(155,93,229,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid #9b5de5' }}>
                  <img
                    src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80"
                    alt="Restaurant QR Example"
                    style={{ width: 220, height: 300, objectFit: 'cover', borderRadius: 24, boxShadow: '0 4px 16px 0 rgba(155,93,229,0.10)' }}
                  />
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=https://kolaysiparis.com"
                    alt="QR Code"
                    style={{ position: 'absolute', bottom: 18, right: 18, width: 56, height: 56, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px 0 rgba(155,93,229,0.10)', border: '2px solid #fff' }}
                  />
                </div>
              </div>
            </main>
            {/* Çerez Bildirimi */}
            {showCookie && (
              <div style={{ position: 'fixed', left: 24, bottom: 24, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px 0 rgba(155,93,229,0.08)', padding: '18px 32px', zIndex: 100, minWidth: 320, maxWidth: 400 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: PRIMARY_COLOR, fontSize: 18 }}>KolaySipariş</span>
                </div>
                <div style={{ color: '#444', fontSize: 15, marginBottom: 12 }}>
                  KolaySipariş uses cookies to provide you with better service.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={{ background: 'none', border: `1.5px solid ${PRIMARY_COLOR}`, color: PRIMARY_COLOR, borderRadius: 8, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Settings</button>
                  <button style={{ background: 'none', border: `1.5px solid #e649f5`, color: '#e649f5', borderRadius: 8, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                  <button style={{ background: PRIMARY_COLOR, color: BUTTON_TEXT, border: 'none', borderRadius: 8, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowCookie(false)}>Accept</button>
                </div>
              </div>
            )}
          </>
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/products" element={<Products />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
      </Routes>
    </div>
  );
}

export default App; 