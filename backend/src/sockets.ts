import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Map to store connected users (userId -> socketId)
export const connectedUsers = new Map<string, string>();
// Map to store pending directory/file requests
export const pendingRequests = new Map<string, (data: any) => void>();
export let ioInstance: Server | null = null;

export function initSockets(httpServer: HttpServer) {
  ioInstance = new Server(httpServer, {
    cors: { origin: '*' }
  });

  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    connectedUsers.set(user.id, socket.id);
    console.log(`Socket connected: ${user.username} (${socket.id})`);

    socket.on('disconnect', () => {
      if (connectedUsers.get(user.id) === socket.id) {
        connectedUsers.delete(user.id);
      }
      console.log(`Socket disconnected: ${user.username}`);
    });

    // Device responding to a directory request
    socket.on('directory_result', (data: { reqId: string, error?: string, files?: any[] }) => {
      const resolver = pendingRequests.get(data.reqId);
      if (resolver) {
        resolver(data);
        pendingRequests.delete(data.reqId);
      }
    });
  });

  return ioInstance;
}

export function getSocketIdForUser(userId: string): string | undefined {
  return connectedUsers.get(userId);
}
