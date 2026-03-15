import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerHandlers } from './handlers';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    registerHandlers(io, socket);
  });

  return io;
}
