import axios from 'axios';

const API_URL = 'http://localhost:5002/api';

export async function addProduct(name: string, price: number, description: string) {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/products`,
      { name, price, description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Ürün eklenemedi');
  }
}

export async function getProducts() {
  try {
    const response = await axios.get(`${API_URL}/products`);
    return response.data;
  } catch (error: any) {
    throw new Error('Ürünler alınamadı');
  }
} 