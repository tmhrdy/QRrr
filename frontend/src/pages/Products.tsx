import React, { useState, useEffect } from 'react';
import { addProduct, getProducts } from '../api/products';
import { useNavigate } from 'react-router-dom';

const Products: React.FC = () => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || 'Ürünler alınamadı');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await addProduct(name, parseFloat(price), description);
      setSuccess('Ürün başarıyla eklendi!');
      setName('');
      setPrice('');
      setDescription('');
      fetchProducts();
    } catch (err: any) {
      setError(err.message || 'Ürün eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: 32 }}>
      <div style={{ maxWidth: 500, margin: '0 auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px #0001' }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Ürün Ekle</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Ürün Adı"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="number"
              placeholder="Fiyat"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <textarea
              placeholder="Açıklama"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', minHeight: 60 }}
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 12, textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: 12, textAlign: 'center' }}>{success}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 6, background: '#9b5de5', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16 }}>
            {loading ? 'Ekleniyor...' : 'Ürün Ekle'}
          </button>
        </form>
      </div>
      <div style={{ maxWidth: 700, margin: '32px auto 0 auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px #0001' }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Ürünler</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {products.map((product, idx) => (
            <li key={product.id || idx} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
              <strong>{product.name}</strong> - {product.price} TL
              <div style={{ color: '#666', fontSize: 14 }}>{product.description}</div>
            </li>
          ))}
          {products.length === 0 && <li>Hiç ürün yok.</li>}
        </ul>
      </div>
    </div>
  );
};

export default Products; 