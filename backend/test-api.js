const http = require('http');

const BASE_URL = 'http://localhost:5002/api';

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            data: JSON.parse(body)
          };
          resolve(response);
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🧪 API Testleri Başlıyor...\n');

    // 1. Health Check
    console.log('1️⃣ Health Check Testi...');
    const healthResponse = await makeRequest('GET', 'http://localhost:5002/health');
    console.log('✅ Health Check:', healthResponse.data);
    console.log('');

    // 2. Login Test
    console.log('2️⃣ Login Testi...');
    const loginResponse = await makeRequest('POST', '/auth/login', {
      email: 'test@kolaysiparis.com',
      password: 'test123'
    });
    console.log('✅ Login Başarılı:', loginResponse.data);
    const token = loginResponse.data.token;
    console.log('');

    // 3. Auth Me Test
    console.log('3️⃣ Auth Me Testi...');
    const meResponse = await makeRequest('GET', '/auth/me', null, {
      'Authorization': `Bearer ${token}`
    });
    console.log('✅ Auth Me:', meResponse.data);
    console.log('');

    // 4. Restaurants Test
    console.log('4️⃣ Restaurants Testi...');
    const restaurantsResponse = await makeRequest('GET', '/restaurants', null, {
      'Authorization': `Bearer ${token}`
    });
    console.log('✅ Restaurants:', restaurantsResponse.data);
    console.log('');

    // 5. Categories Test
    console.log('5️⃣ Categories Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const categoriesResponse = await makeRequest('GET', `/restaurants/${restaurantId}/categories`, null, {
        'Authorization': `Bearer ${token}`
      });
      console.log('✅ Categories:', categoriesResponse.data);
    }
    console.log('');

    // 6. Products Test
    console.log('6️⃣ Products Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const productsResponse = await makeRequest('GET', `/restaurants/${restaurantId}/products`, null, {
        'Authorization': `Bearer ${token}`
      });
      console.log('✅ Products:', productsResponse.data);
    }
    console.log('');

    // 7. Menu Themes Test
    console.log('7️⃣ Menu Themes Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const themesResponse = await makeRequest('GET', `/restaurants/${restaurantId}/menu-theme`, null, {
        'Authorization': `Bearer ${token}`
      });
      console.log('✅ Menu Themes:', themesResponse.data);
    }
    console.log('');

    // 8. Analytics Test
    console.log('8️⃣ Analytics Testi...');
    if (restaurantsResponse.data.restaurants && restaurantsResponse.data.restaurants.length > 0) {
      const restaurantId = restaurantsResponse.data.restaurants[0].id;
      const analyticsResponse = await makeRequest('GET', `/orders/${restaurantId}/analytics`, null, {
        'Authorization': `Bearer ${token}`
      });
      console.log('✅ Analytics:', analyticsResponse.data);
    }
    console.log('');

    console.log('🎉 Tüm API Testleri Başarılı!');

  } catch (error) {
    console.error('❌ API Test Hatası:', error.message);
  }
}

testAPI(); 