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
const staffSchema = joi_1.default.object({
    user_id: joi_1.default.number().integer().required(),
    role: joi_1.default.string().valid('manager', 'waiter', 'chef', 'cashier').required()
});
router.get('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const result = await (0, connection_1.query)(`SELECT s.*, u.first_name, u.last_name, u.email 
       FROM staff s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.restaurant_id = $1 AND s.is_active = true 
       ORDER BY s.role, u.first_name`, [restaurantId]);
        res.json({
            success: true,
            data: result.rows
        });
        return;
    }
    catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const staffData = value;
        const userResult = await (0, connection_1.query)('SELECT id FROM users WHERE id = $1 AND is_active = true', [staffData.user_id]);
        if (userResult.rows.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Kullanıcı bulunamadı'
            });
            return;
        }
        const existingStaff = await (0, connection_1.query)('SELECT id FROM staff WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true', [staffData.user_id, restaurantId]);
        if (existingStaff.rows.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Bu kullanıcı zaten bu restoranda çalışıyor'
            });
            return;
        }
        const result = await (0, connection_1.query)('INSERT INTO staff (restaurant_id, user_id, role) VALUES ($1, $2, $3) RETURNING *', [restaurantId, staffData.user_id, staffData.role]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Personel başarıyla eklendi'
        });
        return;
    }
    catch (error) {
        console.error('Add staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.put('/:restaurantId/:staffId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
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
        const result = await (0, connection_1.query)('UPDATE staff SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND restaurant_id = $3 RETURNING *', [role, staffId, restaurantId]);
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
    }
    catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.delete('/:restaurantId/:staffId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const staffId = parseInt(req.params.staffId);
        await (0, connection_1.query)('UPDATE staff SET is_active = false WHERE id = $1 AND restaurant_id = $2', [staffId, restaurantId]);
        res.json({
            success: true,
            message: 'Personel başarıyla çıkarıldı'
        });
        return;
    }
    catch (error) {
        console.error('Remove staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
exports.default = router;
//# sourceMappingURL=staff.js.map