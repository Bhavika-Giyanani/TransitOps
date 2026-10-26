import { io, Socket } from 'socket.io-client';

type EventCallback = (data: any) => void;

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public async connect() {
    if (this.socket && this.socket.connected) return;

    try {
      this.socket = io(window.location.origin, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      this.socket.on('connect', () => {
        console.log('[TransitOps] Socket.io real-time connected:', this.socket?.id);
      });

      this.socket.on('trip_dispatched', (data) => this.emit('trip_dispatched', data));
      this.socket.on('trip_completed', (data) => this.emit('trip_completed', data));
      this.socket.on('vehicle_status', (data) => this.emit('vehicle_status', data));
      this.socket.on('driver_status', (data) => this.emit('driver_status', data));
      this.socket.on('maintenance_updated', (data) => this.emit('maintenance_updated', data));
      this.socket.on('expense_updated', (data) => this.emit('expense_updated', data));
      this.socket.on('notification', (notif) => this.emit('notification', notif));

      this.socket.on('connect_error', (error) => {
        console.warn('[TransitOps] Socket.io connection notice:', error.message);
      });
    } catch (error) {
      console.warn('[TransitOps] Realtime connection fallback:', error);
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('[Realtime Error]', err);
        }
      });
    }
  }

  public disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }
}

export const realtime = new RealtimeService();
