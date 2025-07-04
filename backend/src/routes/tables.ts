import { Router, Request, Response } from 'express';
import Joi from 'joi';
import QRCode from 'qrcode';
import { query } from '../database/connection';
import { authenticateToken, authenticateRestaurant } from '../middleware/auth';
import { CreateTableRequest, Table } from '../types';

const router = Router();

// Validation schema
const tableSchema = Joi.object({
  name: Joi.string().min(1).max(50).required()
});

// Restoranın masalarını listele
router.get('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);

    const result = await query(
      'SELECT * FROM tables WHERE restaurant_id = $1 ORDER BY name ASC',
      [restaurantId]
    );

    res.json({
      success: true,
      data: result.rows
    });
    return;
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Masa oluştur ve QR kod üret
router.post('/:restaurantId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
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
    const tableData: CreateTableRequest = value;

    // Masa adı bu restoranda benzersiz mi kontrol et
    const existingTable = await query(
      'SELECT id FROM tables WHERE restaurant_id = $1 AND name = $2',
      [restaurantId, tableData.name]
    );

    if (existingTable.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Bu masa adı zaten kullanımda'
      });
      return;
    }

    // QR kod URL'i oluştur
    const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${tableData.name}`;
    
    // QR kod oluştur
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Masayı oluştur
    const result = await query(
      'INSERT INTO tables (restaurant_id, name, qr_code, qr_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [restaurantId, tableData.name, qrCode, qrUrl]
    );

    const table: Table = result.rows[0];

    res.status(201).json({
      success: true,
      data: table,
      message: 'Masa başarıyla oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Masa güncelle
router.put('/:restaurantId/:tableId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
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
    const tableData: CreateTableRequest = value;

    // Masa adı benzersiz mi kontrol et (kendi adı hariç)
    const existingTable = await query(
      'SELECT id FROM tables WHERE restaurant_id = $1 AND name = $2 AND id != $3',
      [restaurantId, tableData.name, tableId]
    );

    if (existingTable.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Bu masa adı zaten kullanımda'
      });
      return;
    }

    // QR kod URL'i güncelle
    const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${tableData.name}`;
    
    // Yeni QR kod oluştur
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const result = await query(
      'UPDATE tables SET name = $1, qr_code = $2, qr_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND restaurant_id = $5 RETURNING *',
      [tableData.name, qrCode, qrUrl, tableId, restaurantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Masa bulunamadı'
      });
      return;
    }

    const table: Table = result.rows[0];

    res.json({
      success: true,
      data: table,
      message: 'Masa başarıyla güncellendi'
    });
    return;
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// Masa sil
router.delete('/:restaurantId/:tableId', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const tableId = parseInt(req.params.tableId);

    // Masada aktif sipariş var mı kontrol et
    const activeOrders = await query(
      'SELECT COUNT(*) as order_count FROM orders WHERE table_id = $1 AND status IN ($2, $3, $4)',
      [tableId, 'pending', 'preparing', 'ready']
    );

    if (parseInt(activeOrders.rows[0].order_count) > 0) {
      res.status(400).json({
        success: false,
        error: 'Bu masada aktif siparişler bulunduğu için silinemez'
      });
      return;
    }

    // Masayı pasif hale getir
    await query(
      'UPDATE tables SET is_active = false WHERE id = $1 AND restaurant_id = $2',
      [tableId, restaurantId]
    );

    res.json({
      success: true,
      message: 'Masa başarıyla silindi'
    });
    return;
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

// QR kod yeniden oluştur
router.post('/:restaurantId/:tableId/regenerate-qr', authenticateToken, authenticateRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const tableId = parseInt(req.params.tableId);

    // Masayı getir
    const tableResult = await query(
      'SELECT * FROM tables WHERE id = $1 AND restaurant_id = $2',
      [tableId, restaurantId]
    );

    if (tableResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Masa bulunamadı'
      });
      return;
    }

    const table = tableResult.rows[0];

    // Yeni QR kod URL'i oluştur
    const qrUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000/menu'}/${restaurantId}/${table.name}`;
    
    // Yeni QR kod oluştur
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // QR kodu güncelle
    const result = await query(
      'UPDATE tables SET qr_code = $1, qr_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [qrCode, qrUrl, tableId]
    );

    const updatedTable: Table = result.rows[0];

    res.json({
      success: true,
      data: updatedTable,
      message: 'QR kod başarıyla yeniden oluşturuldu'
    });
    return;
  } catch (error) {
    console.error('Regenerate QR error:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
    return;
  }
});

export default router; 