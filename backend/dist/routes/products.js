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
const productSchema = joi_1.default.object({
    category_id: joi_1.default.number().integer().required(),
    name: joi_1.default.string().min(2).max(255).required(),
    description: joi_1.default.string().max(1000),
    price: joi_1.default.number().positive().required(),
    image_url: joi_1.default.string().uri(),
    is_available: joi_1.default.boolean(),
    is_featured: joi_1.default.boolean(),
    allergens: joi_1.default.array().items(joi_1.default.string()),
    nutritional_info: joi_1.default.object(),
    sort_order: joi_1.default.number().integer().min(0)
});
router.get('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { category_id, is_available, is_featured, search } = req.query;
        let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.restaurant_id = $1
    `;
        const params = [restaurantId];
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
        const result = await (0, connection_1.query)(sql, params);
        res.json({
            success: true,
            data: result.rows
        });
        return;
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const productData = value;
        const categoryResult = await (0, connection_1.query)('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2 AND is_active = true', [productData.category_id, restaurantId]);
        if (categoryResult.rows.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Geçersiz kategori'
            });
            return;
        }
        const result = await (0, connection_1.query)(`INSERT INTO products (
        restaurant_id, category_id, name, description, price, image_url, 
        is_available, is_featured, allergens, nutritional_info, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`, [
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
        ]);
        const product = result.rows[0];
        res.status(201).json({
            success: true,
            data: product,
            message: 'Ürün başarıyla oluşturuldu'
        });
        return;
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.put('/:restaurantId/:productId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const productData = value;
        const categoryResult = await (0, connection_1.query)('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2 AND is_active = true', [productData.category_id, restaurantId]);
        if (categoryResult.rows.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Geçersiz kategori'
            });
            return;
        }
        const result = await (0, connection_1.query)(`UPDATE products SET 
        category_id = $1, name = $2, description = $3, price = $4, 
        image_url = $5, is_available = $6, is_featured = $7, 
        allergens = $8, nutritional_info = $9, sort_order = $10, 
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND restaurant_id = $12 RETURNING *`, [
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
        ]);
        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Ürün bulunamadı'
            });
            return;
        }
        const product = result.rows[0];
        res.json({
            success: true,
            data: product,
            message: 'Ürün başarıyla güncellendi'
        });
        return;
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.delete('/:restaurantId/:productId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const productId = parseInt(req.params.productId);
        await (0, connection_1.query)('UPDATE products SET is_available = false WHERE id = $1 AND restaurant_id = $2', [productId, restaurantId]);
        res.json({
            success: true,
            message: 'Ürün başarıyla silindi'
        });
        return;
    }
    catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/public/:restaurantId/:productId/review', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const productId = parseInt(req.params.productId);
        const { rating, comment, customerName, customerEmail } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, error: 'Geçersiz puan (1-5 arası olmalı)' });
        }
        const productResult = await (0, connection_1.query)('SELECT id, name FROM products WHERE id = $1 AND restaurant_id = $2 AND is_available = true', [productId, restaurantId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
        }
        const reviewResult = await (0, connection_1.query)(`INSERT INTO product_reviews (product_id, restaurant_id, rating, comment, customer_name, customer_email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id, rating, comment, customer_name, created_at`, [productId, restaurantId, rating, comment, customerName, customerEmail]);
        await updateProductAverageRating(productId);
        return res.json({
            success: true,
            message: 'Değerlendirme başarıyla eklendi',
            review: reviewResult.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Değerlendirme eklenemedi', detail: error });
    }
});
router.get('/public/:restaurantId/:productId/reviews', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const productId = parseInt(req.params.productId);
        const { limit = 10, offset = 0 } = req.query;
        const productResult = await (0, connection_1.query)('SELECT id, name, average_rating, total_reviews FROM products WHERE id = $1 AND restaurant_id = $2', [productId, restaurantId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
        }
        const reviewsResult = await (0, connection_1.query)(`SELECT id, rating, comment, customer_name, created_at
       FROM product_reviews
       WHERE product_id = $1 AND restaurant_id = $2 AND is_approved = true
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`, [productId, restaurantId, parseInt(limit), parseInt(offset)]);
        const ratingDistributionResult = await (0, connection_1.query)(`SELECT rating, COUNT(*) as count
       FROM product_reviews
       WHERE product_id = $1 AND restaurant_id = $2 AND is_approved = true
       GROUP BY rating
       ORDER BY rating DESC`, [productId, restaurantId]);
        const ratingDistribution = ratingDistributionResult.rows;
        return res.json({
            success: true,
            product: productResult.rows[0],
            reviews: reviewsResult.rows,
            ratingDistribution: ratingDistribution,
            totalReviews: reviewsResult.rows.length
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Değerlendirmeler alınamadı', detail: error });
    }
});
router.get('/:restaurantId/:productId/reviews', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const productId = parseInt(req.params.productId);
        const { status = 'all', limit = 20, offset = 0 } = req.query;
        const productResult = await (0, connection_1.query)('SELECT id, name, average_rating, total_reviews FROM products WHERE id = $1 AND restaurant_id = $2', [productId, restaurantId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
        }
        let whereClause = 'WHERE product_id = $1 AND restaurant_id = $2';
        let params = [productId, restaurantId];
        if (status === 'pending') {
            whereClause += ' AND is_approved IS NULL';
        }
        else if (status === 'approved') {
            whereClause += ' AND is_approved = true';
        }
        else if (status === 'rejected') {
            whereClause += ' AND is_approved = false';
        }
        const reviewsResult = await (0, connection_1.query)(`SELECT id, rating, comment, customer_name, customer_email, is_approved, created_at
       FROM product_reviews
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, parseInt(limit), parseInt(offset)]);
        return res.json({
            success: true,
            product: productResult.rows[0],
            reviews: reviewsResult.rows,
            totalReviews: reviewsResult.rows.length
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Değerlendirmeler alınamadı', detail: error });
    }
});
router.patch('/:restaurantId/reviews/:reviewId/approve', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const reviewId = parseInt(req.params.reviewId);
        const { isApproved } = req.body;
        const reviewResult = await (0, connection_1.query)(`UPDATE product_reviews 
       SET is_approved = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND restaurant_id = $3
       RETURNING id, product_id, rating, comment, customer_name, is_approved`, [isApproved, reviewId, restaurantId]);
        if (reviewResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Değerlendirme bulunamadı' });
        }
        await updateProductAverageRating(reviewResult.rows[0].product_id);
        return res.json({
            success: true,
            message: `Değerlendirme ${isApproved ? 'onaylandı' : 'reddedildi'}`,
            review: reviewResult.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Değerlendirme güncellenemedi', detail: error });
    }
});
async function updateProductAverageRating(productId) {
    try {
        const avgResult = await (0, connection_1.query)(`SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews
       FROM product_reviews
       WHERE product_id = $1 AND is_approved = true`, [productId]);
        const averageRating = avgResult.rows[0].average_rating || 0;
        const totalReviews = avgResult.rows[0].total_reviews || 0;
        await (0, connection_1.query)(`UPDATE products 
       SET average_rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`, [averageRating, totalReviews, productId]);
    }
    catch (error) {
        console.error('Ortalama puan güncellenirken hata:', error);
    }
}
exports.default = router;
//# sourceMappingURL=products.js.map