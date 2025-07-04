import axios from 'axios';

const API_URL = 'http://localhost:5002/api';

export async function login(email: string, password: string) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Giriş başarısız');
  }
}

export async function register(name: string, email: string, password: string, restaurantName: string) {
  try {
    const [first_name, ...rest] = name.trim().split(' ');
    const last_name = rest.join(' ') || '-';
    const response = await axios.post(`${API_URL}/auth/register`, { email, password, first_name, last_name, restaurant_name: restaurantName });
    if (response.status === 201 || response.status === 200) {
      return response.data;
    } else if (response.status === 409) {
      throw new Error('Bu e-posta ile zaten kayıt olunmuş.');
    } else {
      throw new Error(response.data?.error || 'Kayıt başarısız');
    }
  } catch (error: any) {
    if (error.response && error.response.status === 409) {
      throw new Error('Bu e-posta ile zaten kayıt olunmuş.');
    }
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Kayıt başarısız');
  }
} 