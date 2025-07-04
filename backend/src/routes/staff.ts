import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateStaffRequest } from '../types';

const router = Router();

// Validation schema
const staffSchema = Joi.object({
  user_id: Joi.number().integer().required(),
  role: Joi.string().valid('manager', 'waiter', 'chef', 'cashier').required()
});

// Restoranın personelini listele
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);

    const result = await query(
      `SELECT s.*, u.first_name, u.last_name, u.email 
       FROM staff s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.restaurant_id = $1 AND s.is_active = true 
       ORDER BY s.role, u.first_name`,
      [restaurantId]
    );

    res.json({
      success: true,
      data: result.rows
    });
    return;
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Personel ekle
router.post('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = staffSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const staffData: CreateStaffRequest = value;

    // Kullanıcı var mı kontrol et
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [staffData.user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
      return;
    }

    // Bu kullanıcı zaten bu restoranda çalışıyor mu kontrol et
    const existingStaff = await query(
      'SELECT id FROM staff WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true',
      [staffData.user_id, restaurantId]
    );

    if (existingStaff.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Bu kullanıcı zaten bu restoranda çalışıyor'
      });
      return;
    }

    const result = await query(
      'INSERT INTO staff (restaurant_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
      [restaurantId, staffData.user_id, staffData.role]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Personel başarıyla eklendi'
    });
    return;
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Personel rolünü güncelle
router.put('/:restaurantId/:staffId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { role } = req.body;

    if (!role || !['manager', 'waiter', 'chef', 'cashier'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Geçersiz rol'
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const staffId = parseInt(req.params.staffId);

    const result = await query(
      'UPDATE staff SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND restaurant_id = $3 RETURNING *',
      [role, staffId, restaurantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Personel bulunamadı'
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Personel rolü güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Personel çıkar
router.delete('/:restaurantId/:staffId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const staffId = parseInt(req.params.staffId);

    await query(
      'UPDATE staff SET is_active = false WHERE id = $1 AND restaurant_id = $2',
      [staffId, restaurantId]
    );

    res.json({
      success: true,
      message: 'Personel başarıyla çıkarıldı'
    });
    return;
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

export default router; 