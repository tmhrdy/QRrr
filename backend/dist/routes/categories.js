"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const express_2 = __importDefault(require("express"));
const connection_2 = require("../database/connection");
const router = (0, express_1.Router)();
const categorySchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    description: joi_1.default.string().max(500),
    image_url: joi_1.default.string().uri(),
    sort_order: joi_1.default.number().integer().min(0)
});
router.get('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const result = await (0, connection_1.query)('SELECT * FROM categories WHERE restaurant_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC', [restaurantId]);
        res.json({
            success: true,
            data: result.rows
        });
        return;
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const categoryData = value;
        const result = await (0, connection_1.query)('INSERT INTO categories (restaurant_id, name, description, image_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *', [restaurantId, categoryData.name, categoryData.description, categoryData.image_url, categoryData.sort_order || 0]);
        const category = result.rows[0];
        res.status(201).json({
            success: true,
            data: category,
            message: 'Kategori başarıyla oluşturuldu'
        });
        return;
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.put('/:restaurantId/:categoryId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const categoryData = value;
        const result = await (0, connection_1.query)('UPDATE categories SET name = $1, description = $2, image_url = $3, sort_order = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND restaurant_id = $6 RETURNING *', [categoryData.name, categoryData.description, categoryData.image_url, categoryData.sort_order || 0, categoryId, restaurantId]);
        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Kategori bulunamadı'
            });
            return;
        }
        const category = result.rows[0];
        res.json({
            success: true,
            data: category,
            message: 'Kategori başarıyla güncellendi'
        });
        return;
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.delete('/:restaurantId/:categoryId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const categoryId = parseInt(req.params.categoryId);
        const productsResult = await (0, connection_1.query)('SELECT COUNT(*) as product_count FROM products WHERE category_id = $1 AND restaurant_id = $2', [categoryId, restaurantId]);
        if (parseInt(productsResult.rows[0].product_count) > 0) {
            res.status(400).json({
                success: false,
                error: 'Bu kategoride ürünler bulunduğu için silinemez'
            });
            return;
        }
        await (0, connection_1.query)('UPDATE categories SET is_active = false WHERE id = $1 AND restaurant_id = $2', [categoryId, restaurantId]);
        res.json({
            success: true,
            message: 'Kategori başarıyla silindi'
        });
        return;
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
const expressRouter = express_2.default.Router();
expressRouter.post('/', async (req, res) => {
    const { restaurant_id, name, description } = req.body;
    const result = await connection_2.pool.query('INSERT INTO categories (restaurant_id, name, description) VALUES ($1, $2, $3) RETURNING *', [restaurant_id, name, description]);
    res.json(result.rows[0]);
});
expressRouter.get('/:restaurant_id', async (req, res) => {
    const { restaurant_id } = req.params;
    const result = await connection_2.pool.query('SELECT * FROM categories WHERE restaurant_id = $1', [restaurant_id]);
    res.json(result.rows);
});
exports.default = router;
//# sourceMappingURL=categories.js.map