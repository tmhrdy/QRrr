"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const connection_1 = require("./database/connection");
const socket_1 = require("./socket/socket");
const auth_1 = __importDefault(require("./routes/auth"));
const restaurants_1 = __importDefault(require("./routes/restaurants"));
const categories_1 = __importDefault(require("./routes/categories"));
const products_1 = __importDefault(require("./routes/products"));
const tables_1 = __importDefault(require("./routes/tables"));
const orders_1 = __importDefault(require("./routes/orders"));
const staff_1 = __importDefault(require("./routes/staff"));
const payments_1 = __importDefault(require("./routes/payments"));
const menus_1 = __importDefault(require("./routes/menus"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFound_1 = require("./middleware/notFound");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 5002;
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.'
});
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(limiter);
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static('uploads'));
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API çalışıyor!' });
});
app.use('/api/auth', auth_1.default);
app.use('/api/restaurants', restaurants_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/products', products_1.default);
app.use('/api/tables', tables_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/staff', staff_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/menus', menus_1.default);
(0, socket_1.setupSocketIO)(io);
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
async function startServer() {
    try {
        await (0, connection_1.connectDatabase)();
        console.log('✅ Veritabanı bağlantısı başarılı');
        server.listen(PORT, () => {
            console.log(`🚀 Server ${PORT} portunda çalışıyor`);
            console.log(`📱 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 API: http://localhost:${PORT}/api`);
            console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
        });
    }
    catch (error) {
        console.error('❌ Server başlatılamadı:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => {
    console.log('SIGTERM alındı, server kapatılıyor...');
    server.close(() => {
        console.log('Server kapatıldı');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT alındı, server kapatılıyor...');
    server.close(() => {
        console.log('Server kapatıldı');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=index.js.map