import 'dotenv/config';
import app from './app';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { initSockets } from './sockets';

const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';
const prisma = new PrismaClient();

async function startServer() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('Successfully connected to Neon cloud database.');

    const server = http.createServer(app);
    initSockets(server);

    server.listen(PORT, HOST, () => {
      console.log(`Server is running and listening on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
}

startServer();
