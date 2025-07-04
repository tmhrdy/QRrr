import { Server } from 'socket.io';
import { Order } from '../types';
export declare const setupSocketIO: (io: Server) => void;
export declare const emitOrderCreated: (io: Server, restaurantId: number, order: Order) => void;
export declare const emitOrderUpdated: (io: Server, restaurantId: number, order: Order) => void;
export declare const emitOrderStatusChanged: (io: Server, restaurantId: number, orderId: number, status: string, estimatedTime?: number) => void;
export declare const emitOrderStatusToTable: (io: Server, tableId: number, orderId: number, status: string, estimatedTime?: number) => void;
export declare const emitRestaurantStats: (io: Server, restaurantId: number, stats: {
    totalOrders: number;
    pendingOrders: number;
    preparingOrders: number;
    readyOrders: number;
    todayRevenue: number;
}) => void;
//# sourceMappingURL=socket.d.ts.map