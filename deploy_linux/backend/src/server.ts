import app from './app';
import { PrismaClient } from '@prisma/client';

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

async function startServer() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('Successfully connected to database.');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

startServer();
