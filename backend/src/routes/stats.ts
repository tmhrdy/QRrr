import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../database/connection';

const router = express.Router();

// Dashboard özet istatistikleri
router.get('/summary', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Bugünkü satış toplamı
    const salesResult = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total_sales 
      FROM orders 
      WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE id = $1)
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'completed'
    `, [userId]);

    // Aktif sipariş sayısı
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as active_orders 
      FROM orders 
      WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE id = $1)
      AND status IN ('pending', 'preparing', 'ready')
    `, [userId]);

    // Yorum sayısı (örnek veri)
    const commentsResult = await pool.query(`
      SELECT COUNT(*) as total_comments 
      FROM comments 
      WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE id = $1)
      AND DATE(created_at) = CURRENT_DATE
    `, [userId]);

    res.json({
      sales: salesResult.rows[0]?.total_sales || 0,
      orders: ordersResult.rows[0]?.active_orders || 0,
      comments: commentsResult.rows[0]?.total_comments || 0
    });
  } catch (error) {
    console.error('Stats summary error:', error);
    res.status(500).json({ message: 'İstatistikler alınamadı' });
  }
});

// Günlük satış raporu
router.get('/daily', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as order_count
      FROM orders 
      WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE id = $1)
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'completed'
    `, [userId]);

    res.json({
      total: result.rows[0]?.total || 0,
      orderCount: result.rows[0]?.order_count || 0,
      date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({ message: 'Günlük rapor alınamadı' });
  }
});

export default router; 