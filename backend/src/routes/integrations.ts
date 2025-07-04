import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../database/connection';

const router = express.Router();

// Google işletme entegrasyonu
router.post('/google', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    // Kullanıcının restoranını bul
    const restaurantResult = await pool.query(
      'SELECT r.id, r.name FROM restaurants r JOIN users u ON r.user_id = u.id WHERE u.id = $1',
      [userId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ message: 'Restoran bulunamadı' });
    }

    const restaurant = restaurantResult.rows[0];

    // Google entegrasyonu için örnek response
    // Gerçek uygulamada Google Places API kullanılır
    return res.json({
      success: true,
      message: 'Google işletme profili başarıyla bağlandı',
      restaurant
    });
  } catch (error) {
    return res.status(500).json({ message: 'Google entegrasyonu başarısız', detail: error });
  }
  // fallback return
  return;
});

export default router; 