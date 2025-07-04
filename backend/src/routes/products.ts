import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateProductRequest, Product } from '../types';

const router = Router();

// Validation schema
const productSchema = Joi.object({
  category_id: Joi.number().integer().required(),
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000),
  price: Joi.number().positive().required(),
  image_url: Joi.string().uri(),
  is_available: Joi.boolean(),
  is_featured: Joi.boolean(),
  allergens: Joi.array().items(Joi.string()),
  nutritional_info: Joi.object(),
  sort_order: Joi.number().integer().min(0)
});

// Restoranın ürünlerini listele
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { category_id, is_available, is_featured, search } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.restaurant_id = $1
    `;
    const params: any[] = [restaurantId];
    let paramIndex = 2;

    if (category_id) {
      sql += ` AND p.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (is_available !== undefined) {
      sql += ` AND p.is_available = $${paramIndex}`;
      params.push(is_available === 'true');
      paramIndex++;
    }

    if (is_featured !== undefined) {
      sql += ` AND p.is_featured = $${paramIndex}`;
      params.push(is_featured === 'true');
      paramIndex++;
    }

    if (search) {
      sql += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' ORDER BY p.sort_order ASC, p.name ASC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });
    return;
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Ürün oluştur
router.post('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const productData: CreateProductRequest = value;

    // Kategori bu restorana ait mi kontrol et
    const categoryResult = await query(
      'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2 AND is_active = true',
      [productData.category_id, restaurantId]
    );

    if (categoryResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Geçersiz kategori'
      });
      return;
    }

    const result = await query(
      `INSERT INTO products (
        restaurant_id, category_id, name, description, price, image_url, 
        is_available, is_featured, allergens, nutritional_info, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        restaurantId,
        productData.category_id,
        productData.name,
        productData.description,
        productData.price,
        productData.image_url,
        productData.is_available !== false,
        productData.is_featured || false,
        JSON.stringify(productData.allergens || []),
        JSON.stringify(productData.nutritional_info || {}),
        productData.sort_order || 0
      ]
    );

    const product: Product = result.rows[0];

    res.status(201).json({
      success: true,
      data: product,
      message: 'Ürün başarıyla oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Ürün güncelle
router.put('/:restaurantId/:productId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const productId = parseInt(req.params.productId);
    const productData: CreateProductRequest = value;

    // Kategori bu restorana ait mi kontrol et
    const categoryResult = await query(
      'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2 AND is_active = true',
      [productData.category_id, restaurantId]
    );

    if (categoryResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Geçersiz kategori'
      });
      return;
    }

    const result = await query(
      `UPDATE products SET 
        category_id = $1, name = $2, description = $3, price = $4, 
        image_url = $5, is_available = $6, is_featured = $7, 
        allergens = $8, nutritional_info = $9, sort_order = $10, 
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND restaurant_id = $12 RETURNING *`,
      [
        productData.category_id,
        productData.name,
        productData.description,
        productData.price,
        productData.image_url,
        productData.is_available !== false,
        productData.is_featured || false,
        JSON.stringify(productData.allergens || []),
        JSON.stringify(productData.nutritional_info || {}),
        productData.sort_order || 0,
        productId,
        restaurantId
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Ürün bulunamadı'
      });
      return;
    }

    const product: Product = result.rows[0];

    res.json({
      success: true,
      data: product,
      message: 'Ürün başarıyla güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Ürün sil
router.delete('/:restaurantId/:productId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const productId = parseInt(req.params.productId);

    // Ürünü pasif hale getir
    await query(
      'UPDATE products SET is_available = false WHERE id = $1 AND restaurant_id = $2',
      [productId, restaurantId]
    );

    res.json({
      success: true,
      message: 'Ürün başarıyla silindi'
    });
    return;
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Ürün değerlendirme ve yorum ekleme (public endpoint)
router.post('/public/:restaurantId/:productId/review', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const productId = parseInt(req.params.productId);
    const { rating, comment, customerName, customerEmail } = req.body;

    // Rating kontrolü
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Geçersiz puan (1-5 arası olmalı)' });
    }

    // Ürünün mevcut olduğunu kontrol et
    const productResult = await query(
      'SELECT id, name FROM products WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
      [productId, restaurantId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    // Değerlendirme ekle
    const reviewResult = await query(
      `INSERT INTO product_reviews (product_id, restaurant_id, rating, comment, customer_name, customer_email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id, rating, comment, customer_name, created_at`,
      [productId, restaurantId, rating, comment, customerName, customerEmail]
    );

    // Ürünün ortalama puanını güncelle
    await updateProductAverageRating(productId);

    return res.json({
      success: true,
      message: 'Değerlendirme başarıyla eklendi',
      review: reviewResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Değerlendirme eklenemedi', detail: error });
  }
});

// Ürün değerlendirmelerini getir (public endpoint)
router.get('/public/:restaurantId/:productId/reviews', async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const productId = parseInt(req.params.productId);
    const { limit = 10, offset = 0 } = req.query;

    // Ürünün mevcut olduğunu kontrol et
    const productResult = await query(
      'SELECT id, name, average_rating, total_reviews FROM products WHERE id = $1 AND restaurant_id = $2',
      [productId, restaurantId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    // Değerlendirmeleri getir
    const reviewsResult = await query(
      `SELECT id, rating, comment, customer_name, created_at
       FROM product_reviews
       WHERE product_id = $1 AND restaurant_id = $2 AND is_approved = true
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [productId, restaurantId, parseInt(limit as string), parseInt(offset as string)]
    );

    // Puan dağılımını hesapla
    const ratingDistributionResult = await query(
      `SELECT rating, COUNT(*) as count
       FROM product_reviews
       WHERE product_id = $1 AND restaurant_id = $2 AND is_approved = true
       GROUP BY rating
       ORDER BY rating DESC`,
      [productId, restaurantId]
    );

    const ratingDistribution = ratingDistributionResult.rows;

    return res.json({
      success: true,
      product: productResult.rows[0],
      reviews: reviewsResult.rows,
      ratingDistribution: ratingDistribution,
      totalReviews: reviewsResult.rows.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Değerlendirmeler alınamadı', detail: error });
  }
});

// Restoran sahibi için ürün değerlendirmelerini getir (onay bekleyenler dahil)
router.get('/:restaurantId/:productId/reviews', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const productId = parseInt(req.params.productId);
    const { status = 'all', limit = 20, offset = 0 } = req.query;

    // Ürünün mevcut olduğunu kontrol et
    const productResult = await query(
      'SELECT id, name, average_rating, total_reviews FROM products WHERE id = $1 AND restaurant_id = $2',
      [productId, restaurantId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    // Değerlendirmeleri getir (filtreleme ile)
    let whereClause = 'WHERE product_id = $1 AND restaurant_id = $2';
    let params = [productId, restaurantId];

    if (status === 'pending') {
      whereClause += ' AND is_approved IS NULL';
    } else if (status === 'approved') {
      whereClause += ' AND is_approved = true';
    } else if (status === 'rejected') {
      whereClause += ' AND is_approved = false';
    }

    const reviewsResult = await query(
      `SELECT id, rating, comment, customer_name, customer_email, is_approved, created_at
       FROM product_reviews
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    return res.json({
      success: true,
      product: productResult.rows[0],
      reviews: reviewsResult.rows,
      totalReviews: reviewsResult.rows.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Değerlendirmeler alınamadı', detail: error });
  }
});

// Değerlendirme onaylama/reddetme (restoran sahibi için)
router.patch('/:restaurantId/reviews/:reviewId/approve', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const reviewId = parseInt(req.params.reviewId);
    const { isApproved } = req.body;

    // Değerlendirmeyi güncelle
    const reviewResult = await query(
      `UPDATE product_reviews 
       SET is_approved = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND restaurant_id = $3
       RETURNING id, product_id, rating, comment, customer_name, is_approved`,
      [isApproved, reviewId, restaurantId]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Değerlendirme bulunamadı' });
    }

    // Ürünün ortalama puanını güncelle
    await updateProductAverageRating(reviewResult.rows[0].product_id);

    return res.json({
      success: true,
      message: `Değerlendirme ${isApproved ? 'onaylandı' : 'reddedildi'}`,
      review: reviewResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Değerlendirme güncellenemedi', detail: error });
  }
});

// Ürün ortalama puanını güncelleme yardımcı fonksiyonu
async function updateProductAverageRating(productId: number) {
  try {
    const avgResult = await query(
      `SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews
       FROM product_reviews
       WHERE product_id = $1 AND is_approved = true`,
      [productId]
    );

    const averageRating = avgResult.rows[0].average_rating || 0;
    const totalReviews = avgResult.rows[0].total_reviews || 0;

    await query(
      `UPDATE products 
       SET average_rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [averageRating, totalReviews, productId]
    );
  } catch (error) {
    console.error('Ortalama puan güncellenirken hata:', error);
  }
}

export default router; 