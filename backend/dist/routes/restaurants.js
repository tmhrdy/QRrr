"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createRestaurantSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(255).required(),
    description: joi_1.default.string().max(1000),
    address: joi_1.default.string().max(500),
    phone: joi_1.default.string().max(20),
    email: joi_1.default.string().email(),
    subdomain: joi_1.default.string().min(3).max(100).pattern(/^[a-z0-9-]+$/)
});
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Kimlik doğrulama gerekli'
            });
            return;
        }
        const result = await (0, connection_1.query)('SELECT * FROM restaurants WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json({
            success: true,
            data: result.rows
        });
        return;
    }
    catch (error) {
        console.error('Get restaurants error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
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
        const restaurantData = value;
        if (restaurantData.subdomain) {
            const existingRestaurant = await (0, connection_1.query)('SELECT id FROM restaurants WHERE subdomain = $1', [restaurantData.subdomain]);
            if (existingRestaurant.rows.length > 0) {
                res.status(400).json({
                    success: false,
                    error: 'Bu alt alan adı zaten kullanımda'
                });
                return;
            }
        }
        const result = await (0, connection_1.query)(`INSERT INTO restaurants (
        user_id, name, description, address, phone, email, subdomain, 
        subscription_plan, subscription_expires_at, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`, [
            req.user.id,
            restaurantData.name,
            restaurantData.description,
            restaurantData.address,
            restaurantData.phone,
            restaurantData.email,
            restaurantData.subdomain,
            'basic',
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            JSON.stringify({})
        ]);
        const restaurant = result.rows[0];
        res.status(201).json({
            success: true,
            data: restaurant,
            message: 'Restoran başarıyla oluşturuldu'
        });
        return;
    }
    catch (error) {
        console.error('Create restaurant error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.get('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
    }
    catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.put('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const restaurantData = value;
        const restaurantId = parseInt(req.params.restaurantId);
        if (restaurantData.subdomain && restaurantData.subdomain !== req.restaurant.subdomain) {
            const existingRestaurant = await (0, connection_1.query)('SELECT id FROM restaurants WHERE subdomain = $1 AND id != $2', [restaurantData.subdomain, restaurantId]);
            if (existingRestaurant.rows.length > 0) {
                res.status(400).json({
                    success: false,
                    error: 'Bu alt alan adı zaten kullanımda'
                });
                return;
            }
        }
        const result = await (0, connection_1.query)(`UPDATE restaurants SET 
        name = $1, description = $2, address = $3, phone = $4, 
        email = $5, subdomain = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`, [
            restaurantData.name,
            restaurantData.description,
            restaurantData.address,
            restaurantData.phone,
            restaurantData.email,
            restaurantData.subdomain,
            restaurantId
        ]);
        const updatedRestaurant = result.rows[0];
        res.json({
            success: true,
            data: updatedRestaurant,
            message: 'Restoran başarıyla güncellendi'
        });
        return;
    }
    catch (error) {
        console.error('Update restaurant error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.delete('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        if (!req.restaurant) {
            res.status(404).json({
                success: false,
                error: 'Restoran bulunamadı'
            });
            return;
        }
        const restaurantId = parseInt(req.params.restaurantId);
        await (0, connection_1.query)('UPDATE restaurants SET is_active = false WHERE id = $1', [restaurantId]);
        res.json({
            success: true,
            message: 'Restoran başarıyla silindi'
        });
        return;
    }
    catch (error) {
        console.error('Delete restaurant error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.get('/:restaurantId/stats', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        if (!req.restaurant) {
            res.status(404).json({
                success: false,
                error: 'Restoran bulunamadı'
            });
            return;
        }
        const restaurantId = parseInt(req.params.restaurantId);
        const todayOrders = await (0, connection_1.query)(`SELECT COUNT(*) as total_orders, 
              SUM(final_amount) as total_revenue,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
              COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_orders,
              COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_orders
       FROM orders 
       WHERE restaurant_id = $1 
       AND DATE(created_at) = CURRENT_DATE`, [restaurantId]);
        const monthlyOrders = await (0, connection_1.query)(`SELECT COUNT(*) as total_orders, 
              SUM(final_amount) as total_revenue
       FROM orders 
       WHERE restaurant_id = $1 
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`, [restaurantId]);
        const totalProducts = await (0, connection_1.query)('SELECT COUNT(*) as total_products FROM products WHERE restaurant_id = $1', [restaurantId]);
        const totalTables = await (0, connection_1.query)('SELECT COUNT(*) as total_tables FROM tables WHERE restaurant_id = $1 AND is_active = true', [restaurantId]);
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
    }
    catch (error) {
        console.error('Get restaurant stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.get('/subdomain/:subdomain', async (req, res) => {
    try {
        const { subdomain } = req.params;
        const result = await (0, connection_1.query)('SELECT * FROM restaurants WHERE subdomain = $1 AND is_active = true', [subdomain]);
        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Restoran bulunamadı'
            });
            return;
        }
        const restaurant = result.rows[0];
        res.json({
            success: true,
            data: restaurant
        });
        return;
    }
    catch (error) {
        console.error('Get restaurant by subdomain error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:parentRestaurantId/branches', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const { name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active = true } = req.body;
        const parentResult = await (0, connection_1.query)('SELECT id, user_id FROM restaurants WHERE id = $1', [parentRestaurantId]);
        if (parentResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ana restoran bulunamadı' });
        }
        const branchResult = await (0, connection_1.query)(`INSERT INTO restaurants (name, description, address, phone, email, instagram, facebook, 
        manager_name, manager_phone, manager_email, opening_hours, is_active, parent_restaurant_id, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
       RETURNING id, name, address, phone, email, manager_name, is_active`, [name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active, parentRestaurantId, parentResult.rows[0].user_id]);
        return res.json({
            success: true,
            message: 'Şube başarıyla oluşturuldu',
            branch: branchResult.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Şube oluşturulamadı', detail: error });
    }
});
router.get('/:parentRestaurantId/branches', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const { status = 'all' } = req.query;
        let whereClause = 'WHERE parent_restaurant_id = $1';
        let params = [parentRestaurantId];
        if (status === 'active') {
            whereClause += ' AND is_active = true';
        }
        else if (status === 'inactive') {
            whereClause += ' AND is_active = false';
        }
        const branchesResult = await (0, connection_1.query)(`SELECT id, name, description, address, phone, email, manager_name, manager_phone, 
              opening_hours, is_active, created_at,
              (SELECT COUNT(*) FROM orders WHERE restaurant_id = restaurants.id) as total_orders,
              (SELECT COUNT(*) FROM products WHERE restaurant_id = restaurants.id) as total_products
       FROM restaurants 
       ${whereClause}
       ORDER BY name`, params);
        return res.json({
            success: true,
            branches: branchesResult.rows
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Şubeler alınamadı', detail: error });
    }
});
router.get('/:parentRestaurantId/branches/:branchId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const branchId = parseInt(req.params.branchId);
        const branchResult = await (0, connection_1.query)(`SELECT r.*, 
              (SELECT COUNT(*) FROM orders WHERE restaurant_id = r.id) as total_orders,
              (SELECT COUNT(*) FROM products WHERE restaurant_id = r.id) as total_products,
              (SELECT COUNT(*) FROM tables WHERE restaurant_id = r.id) as total_tables,
              (SELECT COUNT(*) FROM staff WHERE restaurant_id = r.id) as total_staff
       FROM restaurants r
       WHERE r.id = $1 AND r.parent_restaurant_id = $2`, [branchId, parentRestaurantId]);
        if (branchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
        }
        const recentOrdersResult = await (0, connection_1.query)(`SELECT id, customer_name, total_amount, status, created_at
       FROM orders 
       WHERE restaurant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`, [branchId]);
        const topProductsResult = await (0, connection_1.query)(`SELECT p.name, SUM(oi.quantity) as total_quantity
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1
       GROUP BY p.id, p.name
       ORDER BY total_quantity DESC
       LIMIT 5`, [branchId]);
        return res.json({
            success: true,
            branch: branchResult.rows[0],
            recentOrders: recentOrdersResult.rows,
            topProducts: topProductsResult.rows
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Şube detayları alınamadı', detail: error });
    }
});
router.put('/:parentRestaurantId/branches/:branchId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const branchId = parseInt(req.params.branchId);
        const { name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active } = req.body;
        const updateResult = await (0, connection_1.query)(`UPDATE restaurants 
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
       RETURNING id, name, address, phone, email, manager_name, is_active`, [name, description, address, phone, email, instagram, facebook, manager_name, manager_phone, manager_email, opening_hours, is_active, branchId, parentRestaurantId]);
        if (updateResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
        }
        return res.json({
            success: true,
            message: 'Şube başarıyla güncellendi',
            branch: updateResult.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Şube güncellenemedi', detail: error });
    }
});
router.delete('/:parentRestaurantId/branches/:branchId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const branchId = parseInt(req.params.branchId);
        const branchResult = await (0, connection_1.query)('SELECT id, name FROM restaurants WHERE id = $1 AND parent_restaurant_id = $2', [branchId, parentRestaurantId]);
        if (branchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Şube bulunamadı' });
        }
        await (0, connection_1.query)('DELETE FROM restaurants WHERE id = $1 AND parent_restaurant_id = $2', [branchId, parentRestaurantId]);
        return res.json({
            success: true,
            message: 'Şube başarıyla silindi'
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Şube silinemedi', detail: error });
    }
});
router.get('/:parentRestaurantId/central-report', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const parentRestaurantId = parseInt(req.params.parentRestaurantId);
        const { period = 'month', startDate, endDate } = req.query;
        let dateFilter = '';
        let params = [parentRestaurantId];
        if (startDate && endDate) {
            dateFilter = 'AND o.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        }
        else {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = now;
            dateFilter = 'AND o.created_at BETWEEN $2 AND $3';
            params.push(start.toISOString(), end.toISOString());
        }
        const branchPerformanceResult = await (0, connection_1.query)(`SELECT 
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
       ORDER BY total_revenue DESC`, params);
        const totalStatsResult = await (0, connection_1.query)(`SELECT 
         COUNT(DISTINCT o.id) as total_orders,
         SUM(o.total_amount) as total_revenue,
         AVG(o.total_amount) as avg_order_value,
         COUNT(DISTINCT o.restaurant_id) as active_branches
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE r.parent_restaurant_id = $1 ${dateFilter}`, params);
        const topBranchesResult = await (0, connection_1.query)(`SELECT 
         r.name as branch_name,
         COUNT(o.id) as order_count,
         SUM(o.total_amount) as revenue
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE r.parent_restaurant_id = $1 ${dateFilter}
       GROUP BY r.id, r.name
       ORDER BY revenue DESC
       LIMIT 5`, params);
        return res.json({
            success: true,
            period: period,
            totalStats: totalStatsResult.rows[0],
            branchPerformance: branchPerformanceResult.rows,
            topBranches: topBranchesResult.rows
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Merkezi rapor alınamadı', detail: error });
    }
});
exports.default = router;
//# sourceMappingURL=restaurants.js.map