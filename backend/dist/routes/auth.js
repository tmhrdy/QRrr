"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/register', async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Eksik bilgi' });
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        const result = await connection_1.pool.query('INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name', [email, hash, first_name, last_name]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        return res.status(500).json({ error: 'Kayıt başarısız', detail: error });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Eksik bilgi' });
        }
        const result = await connection_1.pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }
        const user = result.rows[0];
        const valid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Şifre hatalı' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Giriş başarısız', detail: error });
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Yetkisiz' });
    }
    try {
        const result = await connection_1.pool.query('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
        }
        return res.json({ success: true, user: result.rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Bilgi alınamadı', detail: error });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map