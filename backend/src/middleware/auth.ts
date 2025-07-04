import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import { User, JWTPayload } from '../types';

// Request nesnesini genişlet
declare global {
  namespace Express {
    interface Request {
      user?: User;
      restaurant?: any;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtar';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, error: 'Token gerekli.' });
    return;
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ success: false, error: 'Geçersiz token.' });
      return;
    }
    (req as any).user = user;
    next();
    return;
  });
  return;
}

export const authenticateRestaurant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    // Kullanıcının bu restorana erişim yetkisi var mı kontrol et
    const result = await query(
      'SELECT * FROM restaurants WHERE id = $1 AND user_id = $2 AND is_active = true',
      [restaurantId, req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        success: false,
        error: 'Bu restorana erişim yetkiniz yok'
      });
      return;
    }

    req.restaurant = result.rows[0];
    next();
  } catch (error) {
    console.error('Restaurant auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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