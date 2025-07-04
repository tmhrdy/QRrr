import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, first_name, last_name, restaurant_name } = req.body;

    if (!email || !password || !restaurant_name) {
      return res.status(400).json({ error: 'İşletme adı, e-posta ve şifre zorunludur.' });
    }

    // E-posta zaten kayıtlı mı kontrol et
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta ile zaten kayıt olunmuş.' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Kullanıcıyı kaydet
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
      [email, hash, first_name, last_name]
    );
    const user = userResult.rows[0];

    // Restoranı kaydet
    const restaurantResult = await pool.query(
      'INSERT INTO restaurants (user_id, name) VALUES ($1, $2) RETURNING id, name',
      [user.id, restaurant_name]
    );
    const restaurant = restaurantResult.rows[0];

    return res.status(201).json({ user, restaurant });
  } catch (error: any) {
    // Unique violation veya başka bir hata
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bu e-posta ile zaten kayıt olunmuş.' });
    }
    return res.status(500).json({ error: 'Kayıt sırasında beklenmeyen bir hata oluştu.', detail: error.message });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Eksik bilgi' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Şifre hatalı' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Giriş başarısız', detail: error });
  }
});

// Kimlik doğrulama (me)
router.get('/me', authenticateToken, async (req: any, res: Response): Promise<Response> => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Yetkisiz' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Bilgi alınamadı', detail: error });
  }
});

export default router;
