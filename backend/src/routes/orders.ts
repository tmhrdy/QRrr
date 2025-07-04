import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateOrderRequest, Order, OrderItem } from '../types';
import { emitOrderCreated, emitOrderUpdated, emitOrderStatusChanged } from '../socket/socket';
import express from 'express';
import { pool } from '../database/connection';

const router = Router();

// Validation schema
const orderSchema = Joi.object({
  table_id: Joi.number().integer(),
  customer_name: Joi.string().max(100),
  customer_phone: Joi.string().max(20),
  items: Joi.array().items(Joi.object({
    product_id: Joi.number().integer().required(),
    quantity: Joi.number().integer().min(1).required(),
    notes: Joi.string().max(500)
  })).min(1).required(),
  notes: Joi.string().max(1000),
  payment_method: Joi.string().valid('cash', 'card', 'online').default('cash')
});

// Restoranın siparişlerini listele
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { status, date_from, date_to, table_id, page = 1, limit = 20 } = req.query;

    let sql = `
      SELECT o.*, t.name as table_name 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      WHERE o.restaurant_id = $1
    `;
    const params: any[] = [restaurantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (date_from) {
      sql += ` AND DATE(o.created_at) >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      sql += ` AND DATE(o.created_at) <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    if (table_id) {
      sql += ` AND o.table_id = $${paramIndex}`;
      params.push(table_id);
      paramIndex++;
    }

    // Toplam sayıyı al
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Sayfalama
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    sql += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
    return;
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Sipariş oluştur (müşteri için)
router.post('/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const orderData: CreateOrderRequest = value;

    // Restoran aktif mi kontrol et
    const restaurantResult = await query(
      'SELECT * FROM restaurants WHERE id = $1 AND is_active = true',
      [restaurantId]
    );

    if (restaurantResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Restoran bulunamadı'
      });
      return;
    }

    // Ürünleri kontrol et ve fiyatları hesapla
    let totalAmount = 0;
    const orderItems: any[] = [];

    for (const item of orderData.items) {
      const productResult = await query(
        'SELECT * FROM products WHERE id = $1 AND restaurant_id = $2 AND is_available = true',
        [item.product_id, restaurantId]
      );

      if (productResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          error: `Ürün bulunamadı: ${item.product_id}`
        });
        return;
      }

      const product = productResult.rows[0];
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity: item.quantity,
        total_price: itemTotal,
        notes: item.notes
      });
    }

    // Sipariş numarası oluştur
    const orderNumber = `ORD-${restaurantId}-${Date.now()}`;

    // Transaction ile sipariş oluştur
    const orderResult = await query(
      `INSERT INTO orders (
        restaurant_id, table_id, order_number, customer_name, customer_phone,
        status, total_amount, final_amount, payment_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        restaurantId,
        orderData.table_id,
        orderNumber,
        orderData.customer_name,
        orderData.customer_phone,
        'pending',
        totalAmount,
        totalAmount,
        orderData.payment_method,
        orderData.notes
      ]
    );

    const order: Order = orderResult.rows[0];

    // Sipariş detaylarını oluştur
    for (const item of orderItems) {
      await query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, total_price, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [order.id, item.product_id, item.product_name, item.product_price, item.quantity, item.total_price, item.notes]
      );
    }

    // Socket.IO ile bildirim gönder
    emitOrderCreated(req.app.get('io'), restaurantId, order);

    res.status(201).json({
      success: true,
      data: {
        order,
        items: orderItems
      },
      message: 'Sipariş başarıyla oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Sipariş detaylarını getir
router.get('/:restaurantId/:orderId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const orderId = parseInt(req.params.orderId);

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2',
      [orderId, restaurantId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Sipariş bulunamadı'
      });
      return;
    }

    const order: Order = orderResult.rows[0];

    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );

    const items: OrderItem[] = itemsResult.rows;

    res.json({
      success: true,
      data: {
        order,
        items
      }
    });
    return;
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Sipariş durumunu güncelle
router.patch('/:restaurantId/:orderId/status', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { status, estimated_preparation_time } = req.body;

    if (!status || !['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Geçersiz sipariş durumu'
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const orderId = parseInt(req.params.orderId);

    const result = await query(
      'UPDATE orders SET status = $1, estimated_preparation_time = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND restaurant_id = $4 RETURNING *',
      [status, estimated_preparation_time, orderId, restaurantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Sipariş bulunamadı'
      });
      return;
    }

    const order: Order = result.rows[0];

    // Socket.IO ile bildirim gönder
    emitOrderStatusChanged(req.app.get('io'), restaurantId, orderId, status, estimated_preparation_time);
    emitOrderUpdated(req.app.get('io'), restaurantId, order);

    res.json({
      success: true,
      data: order,
      message: 'Sipariş durumu güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Sipariş ödeme durumunu güncelle
router.patch('/:restaurantId/:orderId/payment', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const { payment_status, payment_method } = req.body;

    if (!payment_status || !['pending', 'paid', 'failed'].includes(payment_status)) {
      res.status(400).json({
        success: false,
        error: 'Geçersiz ödeme durumu'
      });
      return;
    }

    const restaurantId = parseInt(req.params.restaurantId);
    const orderId = parseInt(req.params.orderId);

    const result = await query(
      'UPDATE orders SET payment_status = $1, payment_method = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND restaurant_id = $4 RETURNING *',
      [payment_status, payment_method, orderId, restaurantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Sipariş bulunamadı'
      });
      return;
    }

    const order: Order = result.rows[0];

    res.json({
      success: true,
      data: order,
      message: 'Ödeme durumu güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

const expressRouter = express.Router();

expressRouter.post('/', async (req, res) => {
  const { restaurant_id, table_id, order_items } = req.body;
  const orderRes = await pool.query(
    'INSERT INTO orders (restaurant_id, table_id, status, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [restaurant_id, table_id, 'pending']
  );
  const order = orderRes.rows[0];

  for (const item of order_items) {
    await pool.query(
      'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [order.id, item.product_id, item.product_name, item.product_price, item.quantity, item.total_price]
    );
  }
  res.json(order);
});

expressRouter.get('/:restaurant_id', async (req, res) => {
  const { restaurant_id } = req.params;
  const result = await pool.query('SELECT * FROM orders WHERE restaurant_id = $1', [restaurant_id]);
  res.json(result.rows);
});

// Satış analitikleri - genel istatistikler
router.get('/:restaurantId/analytics/overview', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { period = 'month', startDate, endDate } = req.query;

    let dateFilter = '';
    let params: (string | number)[] = [restaurantId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at BETWEEN $2 AND $3';
      params.push(startDate as string, endDate as string);
    } else {
      // Varsayılan periyot filtreleri
      const now = new Date();
      let start: Date, end: Date;
      
      if (period === 'week') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
      } else if (period === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
      } else if (period === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
      } else {
        // Varsayılan olarak bu ay
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
      }

      dateFilter = 'AND created_at BETWEEN $2 AND $3';
      params.push(start.toISOString(), end.toISOString());
    }

    // Genel satış istatistikleri
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(total_amount) as total_revenue,
         AVG(total_amount) as average_order_value,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
       FROM orders 
       WHERE restaurant_id = $1 ${dateFilter}`,
      params
    );

    // Günlük satış trendi
    const dailyTrendResult = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as order_count,
         SUM(total_amount) as daily_revenue
       FROM orders 
       WHERE restaurant_id = $1 ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`,
      params
    );

    // En çok satan ürünler
    const topProductsResult = await pool.query(
      `SELECT 
         p.name as product_name,
         p.id as product_id,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 ${dateFilter}
       GROUP BY p.id, p.name
       ORDER BY total_quantity DESC
       LIMIT 10`,
      params
    );

    // Kategori bazlı satışlar
    const categorySalesResult = await pool.query(
      `SELECT 
         c.name as category_name,
         c.id as category_id,
         COUNT(DISTINCT o.id) as order_count,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 ${dateFilter}
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC`,
      params
    );

    const stats = statsResult.rows[0];
    const completionRate = stats.total_orders > 0 ? (stats.completed_orders / stats.total_orders * 100).toFixed(2) : '0';

    return res.json({
      success: true,
      period: period,
      overview: {
        totalOrders: parseInt(stats.total_orders) || 0,
        totalRevenue: parseFloat(stats.total_revenue) || 0,
        averageOrderValue: parseFloat(stats.average_order_value) || 0,
        completedOrders: parseInt(stats.completed_orders) || 0,
        pendingOrders: parseInt(stats.pending_orders) || 0,
        cancelledOrders: parseInt(stats.cancelled_orders) || 0,
        completionRate: parseFloat(completionRate)
      },
      dailyTrend: dailyTrendResult.rows,
      topProducts: topProductsResult.rows,
      categorySales: categorySalesResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Analitik veriler alınamadı', detail: error });
  }
});

// Detaylı satış raporu
router.get('/:restaurantId/analytics/detailed', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Başlangıç ve bitiş tarihi gerekli' });
    }

    let groupClause = '';
    if (groupBy === 'hour') {
      groupClause = 'DATE_TRUNC(\'hour\', created_at)';
    } else if (groupBy === 'day') {
      groupClause = 'DATE(created_at)';
    } else if (groupBy === 'week') {
      groupClause = 'DATE_TRUNC(\'week\', created_at)';
    } else if (groupBy === 'month') {
      groupClause = 'DATE_TRUNC(\'month\', created_at)';
    }

    // Zaman bazlı satış raporu
    const timeBasedReport = await pool.query(
      `SELECT 
         ${groupClause} as period,
         COUNT(*) as order_count,
         SUM(total_amount) as revenue,
         AVG(total_amount) as avg_order_value,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
       FROM orders 
       WHERE restaurant_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY ${groupClause}
       ORDER BY period DESC`,
      [restaurantId, startDate, endDate]
    );

    // Masa bazlı performans
    const tablePerformanceResult = await pool.query(
      `SELECT 
         t.name as table_name,
         t.id as table_id,
         COUNT(o.id) as order_count,
         SUM(o.total_amount) as total_revenue,
         AVG(o.total_amount) as avg_order_value
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.restaurant_id = $1 AND o.created_at BETWEEN $2 AND $3
       GROUP BY t.id, t.name
       ORDER BY total_revenue DESC`,
      [restaurantId, startDate, endDate]
    );

    // Ödeme yöntemi analizi
    const paymentMethodResult = await pool.query(
      `SELECT 
         payment_method,
         COUNT(*) as usage_count,
         SUM(total_amount) as total_amount
       FROM orders 
       WHERE restaurant_id = $1 AND created_at BETWEEN $2 AND $3 AND payment_method IS NOT NULL
       GROUP BY payment_method
       ORDER BY total_amount DESC`,
      [restaurantId, startDate, endDate]
    );

    return res.json({
      success: true,
      period: { startDate, endDate, groupBy },
      timeBasedReport: timeBasedReport.rows,
      tablePerformance: tablePerformanceResult.rows,
      paymentMethods: paymentMethodResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Detaylı rapor alınamadı', detail: error });
  }
});

// Ürün performans analizi
router.get('/:restaurantId/analytics/products', authenticateToken, authenticateRestaurant, async (req: any, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { startDate, endDate, limit = 20 } = req.query;

    let dateFilter = '';
    let params: (string | number)[] = [restaurantId];

    if (startDate && endDate) {
      dateFilter = 'AND o.created_at BETWEEN $2 AND $3';
      params.push(startDate as string, endDate as string);
    }

    // Ürün performans detayları
    const productPerformanceResult = await pool.query(
      `SELECT 
         p.id as product_id,
         p.name as product_name,
         p.price as current_price,
         c.name as category_name,
         COUNT(DISTINCT o.id) as order_count,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue,
         AVG(oi.quantity) as avg_quantity_per_order,
         AVG(oi.price) as avg_selling_price,
         p.average_rating,
         p.total_reviews
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 ${dateFilter}
       GROUP BY p.id, p.name, p.price, c.name, p.average_rating, p.total_reviews
       ORDER BY total_revenue DESC
       LIMIT $${params.length + 1}`,
      [...params, parseInt(limit as string)]
    );

    // Ürün satış trendi (son 30 gün)
    const productTrendResult = await pool.query(
      `SELECT 
         p.id as product_id,
         p.name as product_name,
         DATE(o.created_at) as date,
         SUM(oi.quantity) as daily_quantity,
         SUM(oi.quantity * oi.price) as daily_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY p.id, p.name, DATE(o.created_at)
       ORDER BY p.id, date DESC`,
      [restaurantId]
    );

    return res.json({
      success: true,
      productPerformance: productPerformanceResult.rows,
      productTrend: productTrendResult.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ürün analitikleri alınamadı', detail: error });
  }
});

export default router; 