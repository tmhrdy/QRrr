"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const qrcode_1 = __importDefault(require("qrcode"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const tableSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(50).required()
});
router.get('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const result = await (0, connection_1.query)('SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY name ASC', [restaurantId]);
        res.json({
            success: true,
            data: result.rows
        });
        return;
    }
    catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:restaurantId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const { error, value } = tableSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: error.details[0].message
            });
            return;
        }
        const restaurantId = parseInt(req.params.restaurantId);
        const tableData = value;
        const existingTable = await (0, connection_1.query)('SELECT id FROM tables WHERE restaurant_id = $1 AND name = $2', [restaurantId, tableData.name]);
        if (existingTable.rows.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Bu masa adı zaten kullanımda'
            });
            return;
        }
        const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${tableData.name}`;
        const qrCode = await qrcode_1.default.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        const result = await (0, connection_1.query)('INSERT INTO tables (restaurant_id, name, qr_code, qr_url) VALUES ($1, $2, $3, $4) RETURNING *', [restaurantId, tableData.name, qrCode, qrUrl]);
        const table = result.rows[0];
        res.status(201).json({
            success: true,
            data: table,
            message: 'Masa başarıyla oluşturuldu'
        });
        return;
    }
    catch (error) {
        console.error('Create table error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.put('/:restaurantId/:tableId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const { error, value } = tableSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: error.details[0].message
            });
            return;
        }
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const tableData = value;
        const existingTable = await (0, connection_1.query)('SELECT id FROM tables WHERE restaurant_id = $1 AND name = $2 AND id != $3', [restaurantId, tableData.name, tableId]);
        if (existingTable.rows.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Bu masa adı zaten kullanımda'
            });
            return;
        }
        const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${tableData.name}`;
        const qrCode = await qrcode_1.default.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        const result = await (0, connection_1.query)('UPDATE tables SET name = $1, qr_code = $2, qr_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND restaurant_id = $5 RETURNING *', [tableData.name, qrCode, qrUrl, tableId, restaurantId]);
        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Masa bulunamadı'
            });
            return;
        }
        const table = result.rows[0];
        res.json({
            success: true,
            data: table,
            message: 'Masa başarıyla güncellendi'
        });
        return;
    }
    catch (error) {
        console.error('Update table error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.delete('/:restaurantId/:tableId', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const activeOrders = await (0, connection_1.query)('SELECT COUNT(*) as order_count FROM orders WHERE table_id = $1 AND status IN ($2, $3, $4)', [tableId, 'pending', 'preparing', 'ready']);
        if (parseInt(activeOrders.rows[0].order_count) > 0) {
            res.status(400).json({
                success: false,
                error: 'Bu masada aktif siparişler bulunduğu için silinemez'
            });
            return;
        }
        await (0, connection_1.query)('UPDATE tables SET is_active = false WHERE id = $1 AND restaurant_id = $2', [tableId, restaurantId]);
        res.json({
            success: true,
            message: 'Masa başarıyla silindi'
        });
        return;
    }
    catch (error) {
        console.error('Delete table error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
router.post('/:restaurantId/:tableId/regenerate-qr', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const tableResult = await (0, connection_1.query)('SELECT * FROM tables WHERE id = $1 AND restaurant_id = $2', [tableId, restaurantId]);
        if (tableResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Masa bulunamadı'
            });
            return;
        }
        const table = tableResult.rows[0];
        const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${table.name}`;
        const qrCode = await qrcode_1.default.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        const result = await (0, connection_1.query)('UPDATE tables SET qr_code = $1, qr_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *', [qrCode, qrUrl, tableId]);
        const updatedTable = result.rows[0];
        res.json({
            success: true,
            data: updatedTable,
            message: 'QR kod başarıyla yeniden oluşturuldu'
        });
        return;
    }
    catch (error) {
        console.error('Regenerate QR error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
        return;
    }
});
exports.default = router;
//# sourceMappingURL=tables.js.map