"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const connection_1 = require("../database/connection");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ dest: path_1.default.join(__dirname, '../../uploads/') });
async function getUserRestaurantId(userId) {
    const result = await connection_1.pool.query('SELECT id FROM restaurants WHERE user_id = $1 LIMIT 1', [userId]);
    if (result.rows.length === 0)
        return null;
    return result.rows[0].id;
}
router.get('/', auth_1.authenticateToken, async (req, res) => {
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const restaurantId = await getUserRestaurantId(req.user.userId);
    if (!restaurantId) {
        return res.status(404).json({ error: 'Restoran bulunamadı' });
    }
    try {
        const result = await connection_1.pool.query('SELECT * FROM menus WHERE restaurant_id = $1', [restaurantId]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Menüler alınamadı', detail: err });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const restaurantId = await getUserRestaurantId(req.user.userId);
    if (!restaurantId) {
        return res.status(404).json({ error: 'Restoran bulunamadı' });
    }
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'İsim zorunlu' });
    }
    try {
        const result = await connection_1.pool.query('INSERT INTO menus (name, description, restaurant_id) VALUES ($1, $2, $3) RETURNING *', [name, description, restaurantId]);
        return res.json(result.rows[0]);
    }
    catch (err) {
        return res.status(500).json({ error: 'Menü eklenemedi', detail: err });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const restaurantId = await getUserRestaurantId(req.user.userId);
    if (!restaurantId) {
        return res.status(404).json({ error: 'Restoran bulunamadı' });
    }
    try {
        const result = await connection_1.pool.query('SELECT * FROM menus WHERE id = $1 AND restaurant_id = $2', [req.params.id, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menü bulunamadı' });
        }
        return res.json(result.rows[0]);
    }
    catch (err) {
        return res.status(500).json({ error: 'Menü alınamadı', detail: err });
    }
});
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const restaurantId = await getUserRestaurantId(req.user.userId);
    if (!restaurantId) {
        return res.status(404).json({ error: 'Restoran bulunamadı' });
    }
    const { name, description } = req.body;
    try {
        const result = await connection_1.pool.query('UPDATE menus SET name = $1, description = $2 WHERE id = $3 AND restaurant_id = $4 RETURNING *', [name, description, req.params.id, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menü bulunamadı' });
        }
        return res.json(result.rows[0]);
    }
    catch (err) {
        return res.status(500).json({ error: 'Menü güncellenemedi', detail: err });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const restaurantId = await getUserRestaurantId(req.user.userId);
    if (!restaurantId) {
        return res.status(404).json({ error: 'Restoran bulunamadı' });
    }
    try {
        const result = await connection_1.pool.query('DELETE FROM menus WHERE id = $1 AND restaurant_id = $2 RETURNING *', [req.params.id, restaurantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menü bulunamadı' });
        }
        return res.json({ success: true });
    }
    catch (err) {
        return res.status(500).json({ error: 'Menü silinemedi', detail: err });
    }
});
const extractProductsFromPDF = (pdfText) => {
    const lines = pdfText.split('\n').filter(line => line.trim());
    const products = [];
    const categories = new Set();
    const pricePattern = /(\d+[.,]\d+|\d+)\s*(TL|₺|$)/i;
    const productPattern = /^([A-ZÇĞIİÖŞÜ][a-zçğıiöşü\s]+?)\s*(\d+[.,]\d+|\d+)\s*(TL|₺|$)/i;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^[A-ZÇĞIİÖŞÜ\s]+$/) && line.length > 3 && line.length < 50) {
            categories.add(line.trim());
            continue;
        }
        const productMatch = line.match(productPattern);
        if (productMatch) {
            const productName = productMatch[1].trim();
            const price = parseFloat(productMatch[2].replace(',', '.'));
            if (productName.length > 2 && price > 0) {
                products.push({
                    name: productName,
                    price: price,
                    description: '',
                    category: Array.from(categories).pop() || 'Genel'
                });
            }
        }
    }
    return { products, categories: Array.from(categories) };
};
router.post('/import-pdf', auth_1.authenticateToken, upload.single('menuPdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'PDF dosyası gerekli.' });
        }
        const pdfPath = req.file.path;
        const dataBuffer = fs_1.default.readFileSync(pdfPath);
        const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
        const { products, categories } = extractProductsFromPDF(pdfData.text);
        const userId = req.user.userId;
        const restaurantResult = await connection_1.pool.query('SELECT id FROM restaurants WHERE user_id = $1 LIMIT 1', [userId]);
        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Restoran bulunamadı.' });
        }
        const restaurantId = restaurantResult.rows[0].id;
        const categoryIds = [];
        for (const categoryName of categories) {
            const categoryResult = await connection_1.pool.query('INSERT INTO categories (name, restaurant_id) VALUES ($1, $2) ON CONFLICT (name, restaurant_id) DO UPDATE SET name = EXCLUDED.name RETURNING id', [categoryName, restaurantId]);
            categoryIds.push(categoryResult.rows[0].id);
        }
        const addedProducts = [];
        for (const product of products) {
            let categoryId = null;
            if (product.category !== 'Genel') {
                const catResult = await connection_1.pool.query('SELECT id FROM categories WHERE name = $1 AND restaurant_id = $2', [product.category, restaurantId]);
                categoryId = catResult.rows[0]?.id;
            }
            const productResult = await connection_1.pool.query('INSERT INTO products (name, price, description, category_id, restaurant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, price', [product.name, product.price, product.description, categoryId, restaurantId]);
            addedProducts.push(productResult.rows[0]);
        }
        fs_1.default.unlinkSync(pdfPath);
        return res.json({
            success: true,
            message: 'PDF başarıyla işlendi',
            extracted: {
                products: addedProducts,
                categories: categories,
                totalProducts: addedProducts.length,
                totalCategories: categories.length
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'PDF işlenemedi', detail: err });
    }
});
router.post('/:restaurantId/theme', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const { primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, fontSize, showPrices, showDescriptions, showImages, layout, customCSS } = req.body;
        const restaurantId = parseInt(req.params.restaurantId);
        const result = await connection_1.pool.query(`INSERT INTO menu_themes (restaurant_id, primary_color, secondary_color, background_color, text_color, font_family, font_size, show_prices, show_descriptions, show_images, layout, custom_css, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       ON CONFLICT (restaurant_id) 
       DO UPDATE SET 
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         background_color = EXCLUDED.background_color,
         text_color = EXCLUDED.text_color,
         font_family = EXCLUDED.font_family,
         font_size = EXCLUDED.font_size,
         show_prices = EXCLUDED.show_prices,
         show_descriptions = EXCLUDED.show_descriptions,
         show_images = EXCLUDED.show_images,
         layout = EXCLUDED.layout,
         custom_css = EXCLUDED.custom_css,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`, [restaurantId, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, fontSize, showPrices, showDescriptions, showImages, layout, customCSS]);
        return res.json({
            success: true,
            theme: result.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Tema ayarları kaydedilemedi', detail: error });
    }
});
router.get('/:restaurantId/theme', auth_1.authenticateToken, auth_1.authenticateRestaurant, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const result = await connection_1.pool.query('SELECT * FROM menu_themes WHERE restaurant_id = $1', [restaurantId]);
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                theme: {
                    primaryColor: '#FF6B35',
                    secondaryColor: '#F7931E',
                    backgroundColor: '#FFFFFF',
                    textColor: '#333333',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px',
                    showPrices: true,
                    showDescriptions: true,
                    showImages: true,
                    layout: 'grid',
                    customCSS: ''
                }
            });
        }
        return res.json({
            success: true,
            theme: result.rows[0]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Tema ayarları alınamadı', detail: error });
    }
});
router.get('/:restaurantId/preview', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { device = 'mobile' } = req.query;
        const restaurantResult = await connection_1.pool.query('SELECT id, name, description, logo_url, address, phone, email, instagram, facebook FROM restaurants WHERE id = $1', [restaurantId]);
        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Restoran bulunamadı' });
        }
        const themeResult = await connection_1.pool.query('SELECT * FROM menu_themes WHERE restaurant_id = $1', [restaurantId]);
        const categoriesResult = await connection_1.pool.query('SELECT id, name, description, image_url, sort_order FROM categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [restaurantId]);
        const productsResult = await connection_1.pool.query(`SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_available, p.allergens, p.nutrition_info, p.calories, c.name as category_name, c.id as category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.restaurant_id = $1 AND p.is_available = true
       ORDER BY c.sort_order, c.name, p.name`, [restaurantId]);
        const deviceSettings = {
            mobile: {
                fontSize: '14px',
                layout: 'list',
                showImages: true,
                maxWidth: '100%'
            },
            tablet: {
                fontSize: '16px',
                layout: 'grid',
                showImages: true,
                maxWidth: '768px'
            },
            desktop: {
                fontSize: '18px',
                layout: 'grid',
                showImages: true,
                maxWidth: '1200px'
            }
        };
        const settings = deviceSettings[device] || deviceSettings.mobile;
        return res.json({
            success: true,
            restaurant: restaurantResult.rows[0],
            theme: themeResult.rows[0] || {
                primaryColor: '#FF6B35',
                secondaryColor: '#F7931E',
                backgroundColor: '#FFFFFF',
                textColor: '#333333',
                fontFamily: 'Arial, sans-serif',
                fontSize: settings.fontSize,
                showPrices: true,
                showDescriptions: true,
                showImages: settings.showImages,
                layout: settings.layout,
                customCSS: ''
            },
            categories: categoriesResult.rows,
            products: productsResult.rows,
            deviceSettings: settings
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Menü önizleme alınamadı', detail: error });
    }
});
router.get('/public/:restaurantId', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { tableId } = req.query;
        const restaurantResult = await connection_1.pool.query('SELECT id, name, description, logo_url, address, phone, email, instagram, facebook FROM restaurants WHERE id = $1 AND is_active = true', [restaurantId]);
        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Restoran bulunamadı' });
        }
        let tableInfo = null;
        if (tableId) {
            const tableResult = await connection_1.pool.query('SELECT id, name, qr_code FROM tables WHERE id = $1 AND restaurant_id = $2 AND is_active = true', [tableId, restaurantId]);
            if (tableResult.rows.length > 0) {
                tableInfo = tableResult.rows[0];
            }
        }
        const themeResult = await connection_1.pool.query('SELECT * FROM menu_themes WHERE restaurant_id = $1', [restaurantId]);
        const categoriesResult = await connection_1.pool.query('SELECT id, name, description, image_url, sort_order FROM categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [restaurantId]);
        const productsResult = await connection_1.pool.query(`SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_available, p.allergens, p.nutrition_info, p.calories, c.name as category_name, c.id as category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.restaurant_id = $1 AND p.is_available = true
       ORDER BY c.sort_order, c.name, p.name`, [restaurantId]);
        return res.json({
            success: true,
            restaurant: restaurantResult.rows[0],
            table: tableInfo,
            theme: themeResult.rows[0] || {
                primaryColor: '#FF6B35',
                secondaryColor: '#F7931E',
                backgroundColor: '#FFFFFF',
                textColor: '#333333',
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                showPrices: true,
                showDescriptions: true,
                showImages: true,
                layout: 'grid',
                customCSS: ''
            },
            categories: categoriesResult.rows,
            products: productsResult.rows
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Menü bilgileri alınamadı', detail: error });
    }
});
router.post('/public/:restaurantId/cart/add', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { productId, quantity = 1, tableId, sessionId } = req.body;
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ success: false, error: 'Geçersiz ürün bilgisi' });
        }
        const productResult = await connection_1.pool.query('SELECT id, name, price, is_available FROM products WHERE id = $1 AND restaurant_id = $2 AND is_available = true', [productId, restaurantId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
        }
        const product = productResult.rows[0];
        let cartSessionId = sessionId;
        if (!cartSessionId) {
            cartSessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        const cartResult = await connection_1.pool.query(`INSERT INTO cart_items (session_id, product_id, quantity, price, table_id, restaurant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id, product_id) 
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
       RETURNING *`, [cartSessionId, productId, quantity, product.price, tableId, restaurantId]);
        return res.json({
            success: true,
            message: 'Ürün sepete eklendi',
            cartItem: cartResult.rows[0],
            sessionId: cartSessionId
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Ürün sepete eklenemedi', detail: error });
    }
});
router.get('/public/:restaurantId/cart/:sessionId', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { sessionId } = req.params;
        const cartResult = await connection_1.pool.query(`SELECT ci.id, ci.quantity, ci.price, ci.created_at,
              p.id as product_id, p.name, p.description, p.image_url
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.session_id = $1 AND ci.restaurant_id = $2
       ORDER BY ci.created_at DESC`, [sessionId, restaurantId]);
        const total = cartResult.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return res.json({
            success: true,
            cart: cartResult.rows,
            total: total,
            itemCount: cartResult.rows.length
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Sepet bilgileri alınamadı', detail: error });
    }
});
router.post('/public/:restaurantId/order', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { sessionId, tableId, customerName, customerPhone, specialInstructions } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Sepet oturumu gerekli' });
        }
        const cartResult = await connection_1.pool.query(`SELECT ci.quantity, ci.price, p.id as product_id, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.session_id = $1 AND ci.restaurant_id = $2`, [sessionId, restaurantId]);
        if (cartResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Sepet boş' });
        }
        const total = cartResult.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderResult = await connection_1.pool.query(`INSERT INTO orders (restaurant_id, table_id, customer_name, customer_phone, special_instructions, total_amount, status, payment_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending', CURRENT_TIMESTAMP)
       RETURNING id`, [restaurantId, tableId, customerName, customerPhone, specialInstructions, total]);
        const orderId = orderResult.rows[0].id;
        for (const item of cartResult.rows) {
            await connection_1.pool.query(`INSERT INTO order_items (order_id, product_id, quantity, price, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [orderId, item.product_id, item.quantity, item.price]);
        }
        await connection_1.pool.query('DELETE FROM cart_items WHERE session_id = $1 AND restaurant_id = $2', [sessionId, restaurantId]);
        return res.json({
            success: true,
            message: 'Sipariş başarıyla oluşturuldu',
            orderId: orderId,
            total: total
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Sipariş oluşturulamadı', detail: error });
    }
});
exports.default = router;
//# sourceMappingURL=menus.js.map