"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateRestaurant = void 0;
exports.authenticateToken = authenticateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_1 = require("../database/connection");
const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtar';
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ success: false, error: 'Token gerekli.' });
        return;
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ success: false, error: 'Geçersiz token.' });
            return;
        }
        req.user = user;
        next();
        return;
    });
    return;
}
const authenticateRestaurant = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Kimlik doğrulama gerekli'
            });
            return;
        }
        const restaurantId = parseInt(req.params.restaurantId || req.body.restaurant_id);
        if (!restaurantId) {
            res.status(400).json({
                success: false,
                error: 'Restoran ID gerekli'
            });
            return;
        }
        const result = await (0, connection_1.query)('SELECT * FROM restaurants WHERE id = $1 AND user_id = $2 AND is_active = true', [restaurantId, req.user.id]);
        if (result.rows.length === 0) {
            res.status(403).json({
                success: false,
                error: 'Bu restorana erişim yetkiniz yok'
            });
            return;
        }
        req.restaurant = result.rows[0];
        next();
    }
    catch (error) {
        console.error('Restaurant auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası'
        });
    }
};
exports.authenticateRestaurant = authenticateRestaurant;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Kimlik doğrulama gerekli'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                error: 'Bu işlem için yetkiniz yok'
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map