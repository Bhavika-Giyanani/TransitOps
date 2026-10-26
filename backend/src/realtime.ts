import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { verifyJwtToken } from './middleware/auth';

let io: SocketIOServer | null = null;

export function initRealtime(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = typeof token === 'string' ? verifyJwtToken(token) : null;
    if (!user?.tenantId) return next(new Error('Authentication required.'));
    socket.data.tenantId = user.tenantId;
    next();
  });

  io.on('connection', (socket) => {
    const tenantId = socket.data.tenantId as string;
    socket.join(tenantId);
    console.log(`[TransitOps Realtime] Socket connected: ${socket.id} (tenant: ${tenantId})`);

    socket.on('disconnect', () => {
      console.log(`[TransitOps Realtime] Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export const realtimeEmitter = {
  tripDispatched: (trip: any) => {
    if (!io || !trip.tenantId) return;
    io.to(trip.tenantId).emit('trip_dispatched', trip);
  },
  tripCompleted: (trip: any) => {
    if (!io || !trip.tenantId) return;
    io.to(trip.tenantId).emit('trip_completed', trip);
  },
  vehicleStatus: (vehicleId: string, status: string, tenantId: string) => {
    if (!io || !tenantId) return;
    io.to(tenantId).emit('vehicle_status', { vehicleId, status, tenantId });
  },
  driverStatus: (driverId: string, status: string, tenantId: string) => {
    if (!io || !tenantId) return;
    io.to(tenantId).emit('driver_status', { driverId, status, tenantId });
  },
  maintenanceUpdated: (record: any) => {
    if (!io || !record.tenantId) return;
    io.to(record.tenantId).emit('maintenance_updated', record);
  },
  expenseUpdated: (expense: any) => {
    if (!io || !expense.tenantId) return;
    io.to(expense.tenantId).emit('expense_updated', expense);
  },
  notification: (notif: { type: string; title: string; message: string; tenantId?: string; userId?: string }) => {
    if (!io || !notif.tenantId) return;
    io.to(notif.tenantId).emit('notification', notif);
  },
};
