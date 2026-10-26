import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initRealtime(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
  });

  io.on('connection', (socket) => {
    const tenantId = (socket.handshake.query.tenantId as string) || 'demo_tenant';
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
    if (!io) return;
    io.to(trip.tenantId || 'demo_tenant').emit('trip_dispatched', trip);
    io.emit('trip_dispatched', trip);
  },
  tripCompleted: (trip: any) => {
    if (!io) return;
    io.to(trip.tenantId || 'demo_tenant').emit('trip_completed', trip);
    io.emit('trip_completed', trip);
  },
  vehicleStatus: (vehicleId: string, status: string, tenantId = 'demo_tenant') => {
    if (!io) return;
    io.to(tenantId).emit('vehicle_status', { vehicleId, status, tenantId });
    io.emit('vehicle_status', { vehicleId, status, tenantId });
  },
  driverStatus: (driverId: string, status: string, tenantId = 'demo_tenant') => {
    if (!io) return;
    io.to(tenantId).emit('driver_status', { driverId, status, tenantId });
    io.emit('driver_status', { driverId, status, tenantId });
  },
  maintenanceUpdated: (record: any) => {
    if (!io) return;
    io.to(record.tenantId || 'demo_tenant').emit('maintenance_updated', record);
    io.emit('maintenance_updated', record);
  },
  expenseUpdated: (expense: any) => {
    if (!io) return;
    io.to(expense.tenantId || 'demo_tenant').emit('expense_updated', expense);
    io.emit('expense_updated', expense);
  },
  notification: (notif: { type: string; title: string; message: string; tenantId?: string; userId?: string }) => {
    if (!io) return;
    if (notif.tenantId) {
      io.to(notif.tenantId).emit('notification', notif);
    }
    io.emit('notification', notif);
  },
};
