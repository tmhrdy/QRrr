const axios = require('axios');

const BASE_URL = 'http://localhost:5002/api';

async function testAPI() {
  try {
    console.log('🧪 API Testleri Başlıyor...\n');

    // 1. Health Check
    console.log('1️⃣ Health Check Testi...');
    const healthResponse = await axios.get('http://localhost:5002/health');
    console.log('✅ Health Check:', healthResponse.data);
    console.log('');

    // 2. Login Test
    console.log('2️⃣ Login Testi...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@kolaysiparis.com',
      password: 'test123'
    });
    console.log('✅ Login Başarılı:', loginResponse.data);
    const token = loginResponse.data.token;
    console.log('');

    // 3. Auth Me Test
    console.log('3️⃣ Auth Me Testi...');
    const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Auth Me:', meResponse.data);
    console.log('');

    // 4. Restaurants Test
    console.log('4️⃣ Restaurants Testi...');
    const restaurantsResponse = await axios.get(`${BASE_URL}/restaurants`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Restaurants:', restaurantsResponse.data);
    console.log('');

    // 5. Categories Test
    console.log('5️⃣ Categories Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const categoriesResponse = await axios.get(`${BASE_URL}/restaurants/${restaurantId}/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Categories:', categoriesResponse.data);
    }
    console.log('');

    // 6. Products Test
    console.log('6️⃣ Products Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const productsResponse = await axios.get(`${BASE_URL}/restaurants/${restaurantId}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Products:', productsResponse.data);
    }
    console.log('');

    console.log('🎉 Tüm API Testleri Başarılı!');

  } catch (error) {
    console.error('❌ API Test Hatası:', error.response ? error.response.data : error.message);
  }
}

testAPI(); 