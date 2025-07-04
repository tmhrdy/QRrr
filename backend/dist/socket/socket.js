"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitRestaurantStats = exports.emitOrderStatusToTable = exports.emitOrderStatusChanged = exports.emitOrderUpdated = exports.emitOrderCreated = exports.setupSocketIO = void 0;
const setupSocketIO = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 Yeni bağlantı:', socket.id);
        socket.on('join:restaurant', (restaurantId) => {
            socket.join(`restaurant:${restaurantId}`);
            console.log(`👥 Socket ${socket.id} restoran ${restaurantId} odasına katıldı`);
        });
        socket.on('leave:restaurant', (restaurantId) => {
            socket.leave(`restaurant:${restaurantId}`);
            console.log(`👋 Socket ${socket.id} restoran ${restaurantId} odasından ayrıldı`);
        });
        socket.on('join:table', (tableId) => {
            socket.join(`table:${tableId}`);
            console.log(`🪑 Socket ${socket.id} masa ${tableId} odasına katıldı`);
        });
        socket.on('disconnect', () => {
            console.log('❌ Bağlantı kesildi:', socket.id);
        });
    });
};
exports.setupSocketIO = setupSocketIO;
const emitOrderCreated = (io, restaurantId, order) => {
    io.to(`restaurant:${restaurantId}`).emit('order:created', order);
    console.log(`📦 Yeni sipariş bildirimi gönderildi: Restoran ${restaurantId}, Sipariş ${order.id}`);
};
exports.emitOrderCreated = emitOrderCreated;
const emitOrderUpdated = (io, restaurantId, order) => {
    io.to(`restaurant:${restaurantId}`).emit('order:updated', order);
    console.log(`🔄 Sipariş güncelleme bildirimi gönderildi: Restoran ${restaurantId}, Sipariş ${order.id}`);
};
exports.emitOrderUpdated = emitOrderUpdated;
const emitOrderStatusChanged = (io, restaurantId, orderId, status, estimatedTime) => {
    io.to(`restaurant:${restaurantId}`).emit('order:status_changed', {
        orderId,
        status,
        estimatedTime,
        timestamp: new Date().toISOString()
    });
    console.log(`📊 Sipariş durumu değişikliği: Restoran ${restaurantId}, Sipariş ${orderId}, Durum: ${status}`);
};
exports.emitOrderStatusChanged = emitOrderStatusChanged;
const emitOrderStatusToTable = (io, tableId, orderId, status, estimatedTime) => {
    io.to(`table:${tableId}`).emit('order:status_update', {
        orderId,
        status,
        estimatedTime,
        timestamp: new Date().toISOString()
    });
    console.log(`📱 Masa ${tableId} için sipariş durumu güncellendi: Sipariş ${orderId}, Durum: ${status}`);
};
exports.emitOrderStatusToTable = emitOrderStatusToTable;
const emitRestaurantStats = (io, restaurantId, stats) => {
    io.to(`restaurant:${restaurantId}`).emit('restaurant:stats_updated', {
        ...stats,
        timestamp: new Date().toISOString()
    });
    console.log(`📈 Restoran ${restaurantId} istatistikleri güncellendi`);
};
exports.emitRestaurantStats = emitRestaurantStats;
//# sourceMappingURL=socket.js.map