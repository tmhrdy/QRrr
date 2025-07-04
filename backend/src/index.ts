import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { connectDatabase } from './database/connection';
import { setupSocketIO } from './socket/socket';
import authRoutes from './routes/auth';
import restaurantRoutes from './routes/restaurants';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import tableRoutes from './routes/tables';
import orderRoutes from './routes/orders';
import staffRoutes from './routes/staff';
import paymentRoutes from './routes/payments';
import menusRouter from './routes/menus';
import statsRoutes from './routes/stats';
import integrationsRoutes from './routes/integrations';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5002;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına maksimum 100 istek
  message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// /api/test endpointini buraya taşıdım
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API çalışıyor!' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/menus', menusRouter);
app.use('/api/stats', statsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Socket.IO setup
setupSocketIO(io);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Database connection ve server başlatma
async function startServer() {
  try {
    await connectDatabase();
    console.log('✅ Veritabanı bağlantısı başarılı');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server ${PORT} portunda çalışıyor`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Server başlatılamadı:', error);
    process.exit(1);
  }
}

// Graceful shutdown
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