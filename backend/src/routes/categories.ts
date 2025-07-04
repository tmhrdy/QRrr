import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateCategoryRequest, Category } from '../types';
import express from 'express';
import { pool } from '../database/connection';

const router = Router();

// Validation schema
const categorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500),
  image_url: Joi.string().uri(),
  sort_order: Joi.number().integer().min(0)
});

// Restoranın kategorilerini listele
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);

    const result = await query(
      'SELECT * FROM categories WHERE restaurant_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC',
      [restaurantId]
    );

    res.json({
      success: true,
      data: result.rows
    });
    return;
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Kategori oluştur
router.post('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const categoryData: CreateCategoryRequest = value;

    const result = await query(
      'INSERT INTO categories (restaurant_id, name, description, image_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [restaurantId, categoryData.name, categoryData.description, categoryData.image_url, categoryData.sort_order || 0]
    );

    const category: Category = result.rows[0];

    res.status(201).json({
      success: true,
      data: category,
      message: 'Kategori başarıyla oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Kategori güncelle
router.put('/:restaurantId/:categoryId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const categoryId = parseInt(req.params.categoryId);
    const categoryData: CreateCategoryRequest = value;

    const result = await query(
      'UPDATE categories SET name = $1, description = $2, image_url = $3, sort_order = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND restaurant_id = $6 RETURNING *',
      [categoryData.name, categoryData.description, categoryData.image_url, categoryData.sort_order || 0, categoryId, restaurantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Kategori bulunamadı'
      });
      return;
    }

    const category: Category = result.rows[0];

    res.json({
      success: true,
      data: category,
      message: 'Kategori başarıyla güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Kategori sil
router.delete('/:restaurantId/:categoryId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const categoryId = parseInt(req.params.categoryId);

    // Kategoride ürün var mı kontrol et
    const productsResult = await query(
      'SELECT COUNT(*) as product_count FROM products WHERE category_id = $1 AND restaurant_id = $2',
      [categoryId, restaurantId]
    );

    if (parseInt(productsResult.rows[0].product_count) > 0) {
      res.status(400).json({
        success: false,
        error: 'Bu kategoride ürünler bulunduğu için silinemez'
      });
      return;
    }

    // Kategoriyi pasif hale getir
    await query(
      'UPDATE categories SET is_active = false WHERE id = $1 AND restaurant_id = $2',
      [categoryId, restaurantId]
    );

    res.json({
      success: true,
      message: 'Kategori başarıyla silindi'
    });
    return;
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

const expressRouter = express.Router();

expressRouter.post('/', async (req, res) => {
  const { restaurant_id, name, description } = req.body;
  const result = await pool.query(
    'INSERT INTO categories (restaurant_id, name, description) VALUES ($1, $2, $3) RETURNING *',
    [restaurant_id, name, description]
  );
  res.json(result.rows[0]);
});

expressRouter.get('/:restaurant_id', async (req, res) => {
  const { restaurant_id } = req.params;
  const result = await pool.query('SELECT * FROM categories WHERE restaurant_id = $1', [restaurant_id]);
  res.json(result.rows);
});

export default router; 