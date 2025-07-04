import express, { Request, Response } from 'express';
import { pool } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer ayarları (uploads klasörüne kaydeder)
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// Kullanıcıya ait restoranı bulma yardımcı fonksiyonu
async function getUserRestaurantId(userId: number): Promise<number | null> {
  const result = await pool.query('SELECT id FROM restaurants WHERE user_id = $1 LIMIT 1', [userId]);
  if (result.rows.length === 0) return null;
  return result.rows[0].id;
}

// Menüleri listele
router.get('/', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  try {
    const result = await pool.query('SELECT * FROM menus WHERE restaurant_id = $1', [restaurantId]);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Menüler alınamadı', detail: err });
  }
});

// Menü oluştur
router.post('/', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'İsim zorunlu' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO menus (name, description, restaurant_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, restaurantId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Menü eklenemedi', detail: err });
  }
});

// Menü detay
router.get('/:id', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  try {
    const result = await pool.query('SELECT * FROM menus WHERE id = $1 AND restaurant_id = $2', [req.params.id, restaurantId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menü bulunamadı' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Menü alınamadı', detail: err });
  }
});

// Menü güncelle
router.put('/:id', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE menus SET name = $1, description = $2 WHERE id = $3 AND restaurant_id = $4 RETURNING *',
      [name, description, req.params.id, restaurantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menü bulunamadı' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Menü güncellenemedi', detail: err });
  }
});

// Menü sil
router.delete('/:id', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  try {
    const result = await pool.query('DELETE FROM menus WHERE id = $1 AND restaurant_id = $2 RETURNING *', [req.params.id, restaurantId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menü bulunamadı' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Menü silinemedi', detail: err });
  }
});

// Menü aktifleştir
router.post('/activate', authenticateToken, async (req: any, res: express.Response) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const restaurantId = await getUserRestaurantId(req.user.userId);
  if (!restaurantId) {
    return res.status(404).json({ error: 'Restoran bulunamadı' });
  }
  try {
    await pool.query('UPDATE restaurants SET is_menu_active = true WHERE id = $1', [restaurantId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Menü aktifleştirilemedi', detail: err });
  }
  // fallback return
  return;
});

// QR kod endpoint
router.get('/qr', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const restaurantId = await getUserRestaurantId(userId);
    
    if (!restaurantId) {
      return res.status(404).json({ error: 'Restoran bulunamadı' });
    }

    // QR kod URL'ini oluştur
    const qrUrl = `http://localhost:5173/menu/${restaurantId}`;
    
    // Basit QR kod SVG oluştur (gerçek uygulamada qrcode kütüphanesi kullanılır)
    const qrSvg = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12">
          ${qrUrl}
        </text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(qrSvg);
  } catch (error) {
    console.error('QR generation error:', error);
    return res.status(500).json({ error: 'QR kod oluşturulamadı' });
  }
  // fallback return
  return;
});

// PDF'den ürün/kategori çıkarımı için yardımcı fonksiyon
const extractProductsFromPDF = (pdfText: string) => {
  const lines = pdfText.split('\n').filter(line => line.trim());
  const products = [];
  const categories = new Set();
  
  // Basit regex pattern'ları ile ürün ve fiyat çıkarma
  const pricePattern = /(\d+[.,]\d+|\d+)\s*(TL|₺|$)/i;
  const productPattern = /^([A-ZÇĞIİÖŞÜ][a-zçğıiöşü\s]+?)\s*(\d+[.,]\d+|\d+)\s*(TL|₺|$)/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Kategori tespiti (büyük harflerle yazılmış başlıklar)
    if (line.match(/^[A-ZÇĞIİÖŞÜ\s]+$/) && line.length > 3 && line.length < 50) {
      categories.add(line.trim());
      continue;
    }
    
    // Ürün ve fiyat tespiti
    const productMatch = line.match(productPattern);
    if (productMatch) {
      const productName = productMatch[1].trim();
      const price = parseFloat(productMatch[2].replace(',', '.'));
      
      if (productName.length > 2 && price > 0) {
        products.push({
          name: productName,
          price: price,
          description: '',
          category: Array.from(categories).pop() || 'Genel'
        });
      }
    }
  }
  
  return { products, categories: Array.from(categories) };
};

// PDF menü yükleme ve otomatik menü oluşturma (gelişmiş)
router.post('/import-pdf', authenticateToken, upload.single('menuPdf'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'PDF dosyası gerekli.' });
    }
    
    const pdfPath = req.file.path;
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    
    // PDF'den ürün ve kategori çıkarımı
    const { products, categories } = extractProductsFromPDF(pdfData.text);
    
    // Kullanıcının restoranını bul
    const userId = req.user.userId;
    const restaurantResult = await pool.query(
      'SELECT id FROM restaurants WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Restoran bulunamadı.' });
    }
    
    const restaurantId = restaurantResult.rows[0].id;
    
    // Kategorileri veritabanına ekle
    const categoryIds = [];
    for (const categoryName of categories) {
      const categoryResult = await pool.query(
        'INSERT INTO categories (name, restaurant_id) VALUES ($1, $2) ON CONFLICT (name, restaurant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [categoryName, restaurantId]
      );
      categoryIds.push(categoryResult.rows[0].id);
    }
    
    // Ürünleri veritabanına ekle
    const addedProducts = [];
    for (const product of products) {
      // Kategori ID'sini bul
      let categoryId = null;
      if (product.category !== 'Genel') {
        const catResult = await pool.query(
          'SELECT id FROM categories WHERE name = $1 AND restaurant_id = $2',
          [product.category, restaurantId]
        );
        categoryId = catResult.rows[0]?.id;
      }
      
      const productResult = await pool.query(
        'INSERT INTO products (name, price, description, category_id, restaurant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, price',
        [product.name, product.price, product.description, categoryId, restaurantId]
      );
      
      addedProducts.push(productResult.rows[0]);
    }
    
    // Geçici dosyayı sil
    fs.unlinkSync(pdfPath);
    
    return res.json({
      success: true,
      message: 'PDF başarıyla işlendi',
      extracted: {
        products: addedProducts,
        categories: categories,
        totalProducts: addedProducts.length,
        totalCategories: categories.length
      }
    });
    
  } catch (err) {
    return res.status(500).json({ success: false, error: 'PDF işlenemedi', detail: err });
  }
});

// Menü tema ayarlarını kaydet
router.post('/:restaurantId/theme', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const { 
      primaryColor, 
      secondaryColor, 
      backgroundColor, 
      textColor, 
      fontFamily, 
      fontSize,
      showPrices,
      showDescriptions,
      showImages,
      layout,
      customCSS
    } = req.body;

    const restaurantId = parseInt(req.params.restaurantId);

    // Menü tema ayarlarını güncelle veya oluştur
    const result = await pool.query(
      `INSERT INTO menu_themes (restaurant_id, primary_color, secondary_color, background_color, text_color, font_family, font_size, show_prices, show_descriptions, show_images, layout, custom_css, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       ON CONFLICT (restaurant_id) 
       DO UPDATE SET 
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         background_color = EXCLUDED.background_color,
         text_color = EXCLUDED.text_color,
         font_family = EXCLUDED.font_family,
         font_size = EXCLUDED.font_size,
         show_prices = EXCLUDED.show_prices,
         show_descriptions = EXCLUDED.show_descriptions,
         show_images = EXCLUDED.show_images,
         layout = EXCLUDED.layout,
         custom_css = EXCLUDED.custom_css,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [restaurantId, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, fontSize, showPrices, showDescriptions, showImages, layout, customCSS]
    );

    return res.json({
      success: true,
      theme: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Tema ayarları kaydedilemedi', detail: error });
  }
});

// Menü tema ayarlarını getir
router.get('/:restaurantId/theme', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);

    const result = await pool.query(
      'SELECT * FROM menu_themes WHERE restaurant_id = $1',
      [restaurantId]
    );

    if (result.rows.length === 0) {
      // Varsayılan tema ayarlarını döndür
      return res.json({
        success: true,
        theme: {
          primaryColor: '#FF6B35',
          secondaryColor: '#F7931E',
          backgroundColor: '#FFFFFF',
          textColor: '#333333',
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          showPrices: true,
          showDescriptions: true,
          showImages: true,
          layout: 'grid',
          customCSS: ''
        }
      });
    }

    return res.json({
      success: true,
      theme: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Tema ayarları alınamadı', detail: error });
  }
});

// Menü önizleme için yapılandırma getir (mobil/tablet için)
router.get('/:restaurantId/preview', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { device = 'mobile' } = req.query;

    // Restoran bilgilerini getir
    const restaurantResult = await pool.query(
      'SELECT id, name, description, logo_url, address, phone, email, instagram, facebook FROM restaurants WHERE id = $1',
      [restaurantId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Restoran bulunamadı' });
    }

    // Tema ayarlarını getir
    const themeResult = await pool.query(
      'SELECT * FROM menu_themes WHERE restaurant_id = $1',
      [restaurantId]
    );

    // Kategorileri getir
    const categoriesResult = await pool.query(
      'SELECT id, name, description, image_url, sort_order FROM categories WHERE restaurant_id = $1 ORDER BY sort_order, name',
      [restaurantId]
    );

    // Ürünleri getir
    const productsResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_available, p.allergens, p.nutrition_info, p.calories, c.name as category_name, c.id as category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.restaurant_id = $1 AND p.is_available = true
       ORDER BY c.sort_order, c.name, p.name`,
      [restaurantId]
    );

    // Cihaz tipine göre özel ayarlar
    const deviceSettings = {
      mobile: {
        fontSize: '14px',
        layout: 'list',
        showImages: true,
        maxWidth: '100%'
      },
      tablet: {
        fontSize: '16px',
        layout: 'grid',
        showImages: true,
        maxWidth: '768px'
      },
      desktop: {
        fontSize: '18px',
        layout: 'grid',
        showImages: true,
        maxWidth: '1200px'
      }
    };

    const settings = deviceSettings[device as keyof typeof deviceSettings] || deviceSettings.mobile;

    return res.json({
      success: true,
      restaurant: restaurantResult.rows[0],
      theme: themeResult.rows[0] || {
        primaryColor: '#FF6B35',
        secondaryColor: '#F7931E',
        backgroundColor: '#FFFFFF',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        fontSize: settings.fontSize,
        showPrices: true,
        showDescriptions: true,
        showImages: settings.showImages,
        layout: settings.layout,
        customCSS: ''
      },
      categories: categoriesResult.rows,
      products: productsResult.rows,
      deviceSettings: settings
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Menü önizleme alınamadı', detail: error });
  }
});

// QR ile müşteri menü erişimi (public endpoint)
router.get('/public/:restaurantId', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { tableId } = req.query;

    // Restoran bilgilerini getir
    const restaurantResult = await pool.query(
      'SELECT id, name, description, logo_url, address, phone, email, instagram, facebook FROM restaurants WHERE id = $1 AND is_active = true',
      [restaurantId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Restoran bulunamadı' });
    }

    // Masa bilgilerini getir (eğer tableId varsa)
    let tableInfo = null;
    if (tableId) {
      const tableResult = await pool.query(
        'SELECT id, name, qr_code FROM tables WHERE id = $1 AND restaurant_id = $2 AND is_active = true',
        [tableId, restaurantId]
      );
      if (tableResult.rows.length > 0) {
        tableInfo = tableResult.rows[0];
      }
    }

    // Tema ayarlarını getir
    const themeResult = await pool.query(
      'SELECT * FROM menu_themes WHERE restaurant_id = $1',
      [restaurantId]
    );

    // Kategorileri getir
    const categoriesResult = await pool.query(
      'SELECT id, name, description, image_url, sort_order FROM categories WHERE restaurant_id = $1 ORDER BY sort_order, name',
      [restaurantId]
    );

    // Ürünleri getir
    const productsResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_available, p.allergens, p.nutrition_info, p.calories, c.name as category_name, c.id as category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.restaurant_id = $1 AND p.is_available = true
       ORDER BY c.sort_order, c.name, p.name`,
      [restaurantId]
    );

    return res.json({
      success: true,
      restaurant: restaurantResult.rows[0],
      table: tableInfo,
      theme: themeResult.rows[0] || {
        primaryColor: '#FF6B35',
        secondaryColor: '#F7931E',
        backgroundColor: '#FFFFFF',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        showPrices: true,
        showDescriptions: true,
        showImages: true,
        layout: 'grid',
        customCSS: ''
      },
      categories: categoriesResult.rows,
      products: productsResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Menü bilgileri alınamadı', detail: error });
  }
});

// Müşteri sepete ürün ekleme (public endpoint)
router.post('/public/:restaurantId/cart/add', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { productId, quantity = 1, tableId, sessionId } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, error: 'Geçersiz ürün bilgisi' });
    }

    // Ürünün mevcut olduğunu kontrol et
    const productResult = await pool.query(
      'SELECT id, name, price, is_available FROM products WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
      [productId, restaurantId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    const product = productResult.rows[0];

    // Sepet oturumunu oluştur veya güncelle
    let cartSessionId = sessionId;
    if (!cartSessionId) {
      cartSessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Sepete ürün ekle
    const cartResult = await pool.query(
      `INSERT INTO cart_items (session_id, product_id, quantity, price, table_id, restaurant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id, product_id) 
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [cartSessionId, productId, quantity, product.price, tableId, restaurantId]
    );

    return res.json({
      success: true,
      message: 'Ürün sepete eklendi',
      cartItem: cartResult.rows[0],
      sessionId: cartSessionId
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ürün sepete eklenemedi', detail: error });
  }
});

// Müşteri sepetini görüntüleme (public endpoint)
router.get('/public/:restaurantId/cart/:sessionId', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { sessionId } = req.params;

    // Sepet öğelerini getir
    const cartResult = await pool.query(
      `SELECT ci.id, ci.quantity, ci.price, ci.created_at,
              p.id as product_id, p.name, p.description, p.image_url
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.session_id = $1 AND ci.restaurant_id = $2
       ORDER BY ci.created_at DESC`,
      [sessionId, restaurantId]
    );

    // Toplam tutarı hesapla
    const total = cartResult.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return res.json({
      success: true,
      cart: cartResult.rows,
      total: total,
      itemCount: cartResult.rows.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Sepet bilgileri alınamadı', detail: error });
  }
});

// Müşteri sipariş verme (public endpoint)
router.post('/public/:restaurantId/order', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { sessionId, tableId, customerName, customerPhone, specialInstructions } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Sepet oturumu gerekli' });
    }

    // Sepet öğelerini getir
    const cartResult = await pool.query(
      `SELECT ci.quantity, ci.price, p.id as product_id, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.session_id = $1 AND ci.restaurant_id = $2`,
      [sessionId, restaurantId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Sepet boş' });
    }

    // Toplam tutarı hesapla
    const total = cartResult.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Sipariş oluştur
    const orderResult = await pool.query(
      `INSERT INTO orders (restaurant_id, table_id, customer_name, customer_phone, special_instructions, total_amount, status, payment_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending', CURRENT_TIMESTAMP)
       RETURNING id`,
      [restaurantId, tableId, customerName, customerPhone, specialInstructions, total]
    );

    const orderId = orderResult.rows[0].id;

    // Sipariş öğelerini oluştur
    for (const item of cartResult.rows) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    // Sepeti temizle
    await pool.query(
      'DELETE FROM cart_items WHERE session_id = $1 AND restaurant_id = $2',
      [sessionId, restaurantId]
    );

    return res.json({
      success: true,
      message: 'Sipariş başarıyla oluşturuldu',
      orderId: orderId,
      total: total
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Sipariş oluşturulamadı', detail: error });
  }
});

export default router; 