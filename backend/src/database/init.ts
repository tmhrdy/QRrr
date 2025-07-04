import { pool } from './connection';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export async function initializeDatabase() {
  try {
    console.log('🔄 Veritabanı şeması güncelleniyor...');
    
    // Sadece yeni tabloları ve kolonları ekle
    await addNewTablesAndColumns();
    
    console.log('✅ Veritabanı şeması başarıyla güncellendi');
    
    // Test verisi ekle (opsiyonel)
    await addTestData();
    
  } catch (error) {
    console.error('❌ Veritabanı şeması güncellenirken hata:', error);
    throw error;
  }
}

async function addNewTablesAndColumns() {
  try {
    // Yeni tabloları ekle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_themes (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        primary_color VARCHAR(7) DEFAULT '#FF6B35',
        secondary_color VARCHAR(7) DEFAULT '#F7931E',
        background_color VARCHAR(7) DEFAULT '#FFFFFF',
        text_color VARCHAR(7) DEFAULT '#333333',
        font_family VARCHAR(100) DEFAULT 'Arial, sans-serif',
        font_size VARCHAR(10) DEFAULT '16px',
        show_prices BOOLEAN DEFAULT true,
        show_descriptions BOOLEAN DEFAULT true,
        show_images BOOLEAN DEFAULT true,
        layout VARCHAR(20) DEFAULT 'grid',
        custom_css TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, product_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        customer_name VARCHAR(100),
        customer_email VARCHAR(255),
        is_approved BOOLEAN DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Yeni kolonları ekle
    await pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS parent_restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE;');
    await pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100);');
    await pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(20);');
    await pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255);');
    await pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT;');
    await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;');
    await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);');

    // İndeksleri ekle
    await pool.query('CREATE INDEX IF NOT EXISTS idx_menu_themes_restaurant_id ON menu_themes(restaurant_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON cart_items(session_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cart_items_restaurant_id ON cart_items(restaurant_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_product_reviews_restaurant_id ON product_reviews(restaurant_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(is_approved);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_restaurants_parent_id ON restaurants(parent_restaurant_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);');

    console.log('✅ Yeni tablolar ve kolonlar başarıyla eklendi');
    
  } catch (error) {
    console.error('❌ Yeni tablolar eklenirken hata:', error);
    throw error;
  }
}

async function addTestData() {
  try {
    console.log('🔄 Test verisi ekleniyor...');
    
    // Test şifresini hash'le
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    // Test kullanıcısı ekle veya güncelle
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id',
      ['test@kolaysiparis.com', hashedPassword, 'Test', 'Kullanıcı']
    );
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Test restoranı ekle
      const restaurantResult = await pool.query(
        'INSERT INTO restaurants (user_id, name, description, address, phone, email) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id',
        [userId, 'Test Restoran', 'Test restoran açıklaması', 'Test Adres', '555-1234', 'test@restoran.com']
      );
      
      if (restaurantResult.rows.length > 0) {
        const restaurantId = restaurantResult.rows[0].id;
        
        // Test kategorisi ekle
        const categoryResult = await pool.query(
          'INSERT INTO categories (restaurant_id, name, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id',
          [restaurantId, 'Ana Yemekler', 'Ana yemek kategorisi']
        );
        
        if (categoryResult.rows.length > 0) {
          const categoryId = categoryResult.rows[0].id;
          
          // Test ürünü ekle
          await pool.query(
            'INSERT INTO products (restaurant_id, category_id, name, description, price) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [restaurantId, categoryId, 'Test Ürün', 'Test ürün açıklaması', 25.50]
          );
        }
      }
    }
    
    console.log('✅ Test verisi başarıyla eklendi');
    
  } catch (error) {
    console.error('❌ Test verisi eklenirken hata:', error);
  }
}

// Eğer bu dosya doğrudan çalıştırılırsa
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Veritabanı başlatma tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Veritabanı başlatma başarısız:', error);
      process.exit(1);
    });
} 