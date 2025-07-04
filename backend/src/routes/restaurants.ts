import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateRestaurantRequest, Restaurant } from '../types';

const router = Router();

// Validation schema
const createRestaurantSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000),
  address: Joi.string().max(500),
  phone: Joi.string().max(20),
  email: Joi.string().email(),
  subdomain: Joi.string().min(3).max(100).pattern(/^[a-z0-9-]+$/)
});

// Kullanıcının restoranlarını listele
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Kimlik doğrulama gerekli'
      });
      return;
    }

    const result = await query(
      'SELECT * FROM restaurants WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows
    });
    return;
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Restoran oluştur
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { error, value } = createRestaurantSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Kimlik doğrulama gerekli'
      });
      return;
    }

    const restaurantData: CreateRestaurantRequest = value;

    // Subdomain benzersiz mi kontrol et
    if (restaurantData.subdomain) {
      const existingRestaurant = await query(
        'SELECT id FROM restaurants WHERE subdomain = $1',
        [restaurantData.subdomain]
      );

      if (existingRestaurant.rows.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Bu alt alan adı zaten kullanımda'
        });
        return;
      }
    }

    // Restoranı oluştur
    const result = await query(
      `INSERT INTO restaurants (
        user_id, name, description, address, phone, email, subdomain, 
        subscription_plan, subscription_expires_at, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        req.user.id,
        restaurantData.name,
        restaurantData.description,
        restaurantData.address,
        restaurantData.phone,
        restaurantData.email,
        restaurantData.subdomain,
        'basic',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün deneme
        JSON.stringify({})
      ]
    );

    const restaurant: Restaurant = result.rows[0];

    res.status(201).json({
      success: true,
      data: restaurant,
      message: 'Restoran başarıyla oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Restoran detaylarını getir
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    if (!req.restaurant) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    res.json({
      success: true,
      data: req.restaurant
    });
    return;
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Restoran güncelle
router.put('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { error, value } = createRestaurantSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    if (!req.restaurant) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    const restaurantData: CreateRestaurantRequest = value;
    const restaurantId = parseInt(req.params.restaurantId);

    // Subdomain benzersiz mi kontrol et (kendi subdomain'i hariç)
    if (restaurantData.subdomain && restaurantData.subdomain !== req.restaurant.subdomain) {
      const existingRestaurant = await query(
        'SELECT id FROM restaurants WHERE subdomain = $1 AND id != $2',
        [restaurantData.subdomain, restaurantId]
      );

      if (existingRestaurant.rows.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Bu alt alan adı zaten kullanımda'
        });
        return;
      }
    }

    // Restoranı güncelle
    const result = await query(
      `UPDATE restaurants SET 
        name = $1, description = $2, address = $3, phone = $4, 
        email = $5, subdomain = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [
        restaurantData.name,
        restaurantData.description,
        restaurantData.address,
        restaurantData.phone,
        restaurantData.email,
        restaurantData.subdomain,
        restaurantId
      ]
    );

    const updatedRestaurant: Restaurant = result.rows[0];

    res.json({
      success: true,
      data: updatedRestaurant,
      message: 'Restoran başarıyla güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Restoran sil
router.delete('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    if (!req.restaurant) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);

    // Restoranı pasif hale getir (soft delete)
    await query(
      'UPDATE restaurants SET is_active = false WHERE id = $1',
      [restaurantId]
    );

    res.json({
      success: true,
      message: 'Restoran başarıyla silindi'
    });
    return;
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Restoran istatistikleri
router.get('/:restaurantId/stats', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    if (!req.restaurant) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);

    // Bugünkü siparişler
    const todayOrders = await query(
      `SELECT COUNT(*) as total_orders, 
              SUM(final_amount) as total_revenue,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
              COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
              COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders
       FROM orders 
       WHERE restaurant_id = $1 
       AND DATE(created_at) = CURRENT_DATE`,
      [restaurantId]
    );

    // Bu ayki siparişler
    const monthlyOrders = await query(
      `SELECT COUNT(*) as total_orders, 
              SUM(final_amount) as total_revenue
       FROM orders 
       WHERE restaurant_id = $1 
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [restaurantId]
    );

    // Toplam ürün sayısı
    const totalProducts = await query(
      'SELECT COUNT(*) as total_products FROM products WHERE restaurant_id = $1',
      [restaurantId]
    );

    // Toplam masa sayısı
    const totalTables = await query(
      'SELECT COUNT(*) as total_tables FROM tables WHERE restaurant_id = $1 AND is_active = true',
      [restaurantId]
    );

    const stats = {
      today: todayOrders.rows[0],
      monthly: monthlyOrders.rows[0],
      totalProducts: totalProducts.rows[0].total_products,
      totalTables: totalTables.rows[0].total_tables
    };

    res.json({
      success: true,
      data: stats
    });
    return;
  } catch (error) {
    console.error('Get restaurant stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Subdomain ile restoran bul
router.get('/subdomain/:subdomain', async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;

    const result = await query(
      'SELECT * FROM restaurants WHERE subdomain = $1 AND is_active = true',
      [subdomain]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    const restaurant: Restaurant = result.rows[0];

    res.json({
      success: true,
      data: restaurant
    });
    return;
  } catch (error) {
    console.error('Get restaurant by subdomain error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Şube oluşturma
router.post('/:parentRestaurantId/branches', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const { 
      name, 
      description, 
      address, 
      phone, 
      email, 
      instagram, 
      facebook,
      manager_name,
      manager_phone,
      manager_email,
      opening_hours,
      is_active = true
    } = req.body;

    // Ana restoranın mevcut olduğunu kontrol et
    const parentResult = await query(
      'SELECT id, user_id FROM restaurants WHERE id = $1',
      [parentRestaurantId]
    );

    if (parentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ana restoran bulunamadı' });
    }

    // Şube oluştur
    const branchResult = await query(
      `INSERT INTO restaurants (name, description, address, phone, email, instagram, facebook, 
        manager_name, manager_phone, manager_email, opening_hours, is_active, parent_restaurant_id, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
       RETURNING id, name, address, phone, email, manager_name, is_active`,
      [name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active, parentRestaurantId, parentResult.rows[0].user_id]
    );

    return res.json({
      success: true,
      message: 'Şube başarıyla oluşturuldu',
      branch: branchResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Şube oluşturulamadı', detail: error });
  }
});

// Şubeleri listele
router.get('/:parentRestaurantId/branches', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const { status = 'all' } = req.query;

    let whereClause = 'WHERE parent_restaurant_id = $1';
    let params = [parentRestaurantId];

    if (status === 'active') {
      whereClause += ' AND is_active = true';
    } else if (status === 'inactive') {
      whereClause += ' AND is_active = false';
    }

    const branchesResult = await query(
      `SELECT id, name, description, address, phone, email, manager_name, manager_phone, 
              opening_hours, is_active, created_at,
              (SELECT COUNT(*) FROM orders WHERE restaurant_id = restaurants.id) as total_orders,
              (SELECT COUNT(*) FROM products WHERE restaurant_id = restaurants.id) as total_products
       FROM restaurants 
       ${whereClause}
       ORDER BY name`,
      params
    );

    return res.json({
      success: true,
      branches: branchesResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Şubeler alınamadı', detail: error });
  }
});

// Şube detayları
router.get('/:parentRestaurantId/branches/:branchId', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const branchId = parseInt(req.params.branchId);

    const branchResult = await query(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM orders WHERE restaurant_id = r.id) as total_orders,
              (SELECT COUNT(*) FROM products WHERE restaurant_id = r.id) as total_products,
              (SELECT COUNT(*) FROM tables WHERE restaurant_id = r.id) as total_tables,
              (SELECT COUNT(*) FROM staff WHERE restaurant_id = r.id) as total_staff
       FROM restaurants r
       WHERE r.id = $1 AND r.parent_restaurant_id = $2`,
      [branchId, parentRestaurantId]
    );

    if (branchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
    }

    // Son siparişler
    const recentOrdersResult = await query(
      `SELECT id, customer_name, total_amount, status, created_at
       FROM orders 
       WHERE restaurant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [branchId]
    );

    // En çok satan ürünler
    const topProductsResult = await query(
      `SELECT p.name, SUM(oi.quantity) as total_quantity
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
       GROUP BY p.id, p.name
       ORDER BY total_quantity DESC
       LIMIT 5`,
      [branchId]
    );

    return res.json({
      success: true,
      branch: branchResult.rows[0],
      recentOrders: recentOrdersResult.rows,
      topProducts: topProductsResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Şube detayları alınamadı', detail: error });
  }
});

// Şube güncelleme
router.put('/:parentRestaurantId/branches/:branchId', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const branchId = parseInt(req.params.branchId);
    const { 
      name, 
      description, 
      address, 
      phone, 
      email, 
      instagram, 
      facebook,
      manager_name,
      manager_phone,
      manager_email,
      opening_hours,
      is_active
    } = req.body;

    const updateResult = await query(
      `UPDATE restaurants 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           phone = COALESCE($4, phone),
           email = COALESCE($5, email),
           instagram = COALESCE($6, instagram),
           facebook = COALESCE($7, facebook),
           manager_name = COALESCE($8, manager_name),
           manager_phone = COALESCE($9, manager_phone),
           manager_email = COALESCE($10, manager_email),
           opening_hours = COALESCE($11, opening_hours),
           is_active = COALESCE($12, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 AND parent_restaurant_id = $14
       RETURNING id, name, address, phone, email, manager_name, is_active`,
      [name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active, branchId, parentRestaurantId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
    }

    return res.json({
      success: true,
      message: 'Şube başarıyla güncellendi',
      branch: updateResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Şube güncellenemedi', detail: error });
  }
});

// Şube silme
router.delete('/:parentRestaurantId/branches/:branchId', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const branchId = parseInt(req.params.branchId);

    // Şubenin mevcut olduğunu kontrol et
    const branchResult = await query(
      'SELECT id, name FROM restaurants WHERE id = $1 AND parent_restaurant_id = $2',
      [branchId, parentRestaurantId]
    );

    if (branchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
    }

    // Şubeyi sil (cascade ile ilişkili veriler de silinecek)
    await query(
      'DELETE FROM restaurants WHERE id = $1 AND parent_restaurant_id = $2',
      [branchId, parentRestaurantId]
    );

    return res.json({
      success: true,
      message: 'Şube başarıyla silindi'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Şube silinemedi', detail: error });
  }
});

// Merkezi rapor - tüm şubelerin performansı
router.get('/:parentRestaurantId/central-report', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const parentRestaurantId = parseInt(req.params.parentRestaurantId);
    const { period = 'month', startDate, endDate } = req.query;

    let dateFilter = '';
    let params: (string | number)[] = [parentRestaurantId];

    if (startDate && endDate) {
      dateFilter = 'AND o.created_at BETWEEN $2 AND $3';
      params.push(startDate as string, endDate as string);
    } else {
      // Varsayılan olarak bu ay
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = now;
      dateFilter = 'AND o.created_at BETWEEN $2 AND $3';
      params.push(start.toISOString(), end.toISOString());
    }

    // Şube performans raporu
    const branchPerformanceResult = await query(
      `SELECT 
         r.id as branch_id,
         r.name as branch_name,
         r.address as branch_address,
         COUNT(o.id) as total_orders,
         SUM(o.total_amount) as total_revenue,
         AVG(o.total_amount) as avg_order_value,
         COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders
       FROM restaurants r
       LEFT JOIN orders o ON r.id = o.restaurant_id ${dateFilter}
       WHERE r.parent_restaurant_id = $1
       GROUP BY r.id, r.name, r.address
       ORDER BY total_revenue DESC`,
      params
    );

    // Toplam istatistikler
    const totalStatsResult = await query(
      `SELECT 
         COUNT(DISTINCT o.id) as total_orders,
         SUM(o.total_amount) as total_revenue,
         AVG(o.total_amount) as avg_order_value,
         COUNT(DISTINCT o.restaurant_id) as active_branches
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE r.parent_restaurant_id = $1 ${dateFilter}`,
      params
    );

    // En iyi performans gösteren şubeler
    const topBranchesResult = await query(
      `SELECT 
         r.name as branch_name,
         COUNT(o.id) as order_count,
         SUM(o.total_amount) as revenue
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE r.parent_restaurant_id = $1 ${dateFilter}
       GROUP BY r.id, r.name
       ORDER BY revenue DESC
       LIMIT 5`,
      params
    );

    return res.json({
      success: true,
      period: period,
      totalStats: totalStatsResult.rows[0],
      branchPerformance: branchPerformanceResult.rows,
      topBranches: topBranchesResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Merkezi rapor alınamadı', detail: error });
  }
});

export default router; 