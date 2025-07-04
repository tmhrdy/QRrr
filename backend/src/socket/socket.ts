import { Server, Socket } from 'socket.io';
import { Order } from '../types';

export const setupSocketIO = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log('🔌 Yeni bağlantı:', socket.id);

    // Restoran odasına katıl
    socket.on('join:restaurant', (restaurantId: number) => {
      socket.join(`restaurant:${restaurantId}`);
      console.log(`👥 Socket ${socket.id} restoran ${restaurantId} odasına katıldı`);
    });

    // Restoran odasından ayrıl
    socket.on('leave:restaurant', (restaurantId: number) => {
      socket.leave(`restaurant:${restaurantId}`);
      console.log(`👋 Socket ${socket.id} restoran ${restaurantId} odasından ayrıldı`);
    });

    // Masa odasına katıl (müşteri için)
    socket.on('join:table', (tableId: number) => {
      socket.join(`table:${tableId}`);
      console.log(`🪑 Socket ${socket.id} masa ${tableId} odasına katıldı`);
    });

    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
      console.log('❌ Bağlantı kesildi:', socket.id);
    });
  });
};

// Sipariş oluşturulduğunda
export const emitOrderCreated = (io: Server, restaurantId: number, order: Order): void => {
  io.to(`restaurant:${restaurantId}`).emit('order:created', order);
  console.log(`📦 Yeni sipariş bildirimi gönderildi: Restoran ${restaurantId}, Sipariş ${order.id}`);
};

// Sipariş güncellendiğinde
export const emitOrderUpdated = (io: Server, restaurantId: number, order: Order): void => {
  io.to(`restaurant:${restaurantId}`).emit('order:updated', order);
  console.log(`🔄 Sipariş güncelleme bildirimi gönderildi: Restoran ${restaurantId}, Sipariş ${order.id}`);
};

// Sipariş durumu değiştiğinde
export const emitOrderStatusChanged = (
  io: Server, 
  restaurantId: number, 
  orderId: number, 
  status: string,
  estimatedTime?: number
): void => {
  io.to(`restaurant:${restaurantId}`).emit('order:status_changed', {
    orderId,
    status,
    estimatedTime,
    timestamp: new Date().toISOString()
  });
  console.log(`📊 Sipariş durumu değişikliği: Restoran ${restaurantId}, Sipariş ${orderId}, Durum: ${status}`);
};

// Masa odasına sipariş durumu gönder
export const emitOrderStatusToTable = (
  io: Server,
  tableId: number,
  orderId: number,
  status: string,
  estimatedTime?: number
): void => {
  io.to(`table:${tableId}`).emit('order:status_update', {
    orderId,
    status,
    estimatedTime,
    timestamp: new Date().toISOString()
  });
  console.log(`📱 Masa ${tableId} için sipariş durumu güncellendi: Sipariş ${orderId}, Durum: ${status}`);
};

// Restoran istatistikleri güncellendiğinde
export const emitRestaurantStats = (
  io: Server,
  restaurantId: number,
  stats: {
    totalOrders: number;
    pendingOrders: number;
    preparingOrders: number;
    readyOrders: number;
    todayRevenue: number;
  }
): void => {
  io.to(`restaurant:${restaurantId}`).emit('restaurant:stats_updated', {
    ...stats,
    timestamp: new Date().toISOString()
  });
  console.log(`📈 Restoran ${restaurantId} istatistikleri güncellendi`);
}; 