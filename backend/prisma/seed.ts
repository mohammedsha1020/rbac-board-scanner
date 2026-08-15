import { PrismaClient, Role, PermissionType, LoginStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash passwords
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create Users
  const godUser = await prisma.user.upsert({
    where: { username: 'god' },
    update: { passwordHash },
    create: {
      username: 'god',
      email: 'god@boardscanner.app',
      passwordHash,
      role: Role.GOD,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: 'admin',
      email: 'admin@boardscanner.app',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const basicUser = await prisma.user.upsert({
    where: { username: 'basic' },
    update: { passwordHash },
    create: {
      username: 'basic',
      email: 'basic@boardscanner.app',
      passwordHash,
      role: Role.BASIC,
    },
  });

  console.log('Users seeded:', { god: godUser.id, admin: adminUser.id, basic: basicUser.id });

  // 2. Create Device Info
  await prisma.deviceInfo.createMany({
    data: [
      {
        userId: basicUser.id,
        deviceName: "Samsung Galaxy S24 Ultra",
        deviceModel: "SM-S928B",
        androidVersion: "Android 14 (API 34)",
        appVersion: "1.0.0+1",
        storageUsage: BigInt(24500000), // ~24MB
        syncStatus: "Synced",
      },
      {
        userId: adminUser.id,
        deviceName: "Google Pixel 8 Pro",
        deviceModel: "GC3VE",
        androidVersion: "Android 14 (API 34)",
        appVersion: "1.0.0+1",
        storageUsage: BigInt(1280000), // ~1.2MB
        syncStatus: "Synced",
      }
    ]
  });

  // 3. Create Folders (Subject Folders for Basic User)
  const mathFolder = await prisma.folder.create({
    data: {
      name: 'Mathematics',
      ownerId: basicUser.id,
    }
  });

  const physicsFolder = await prisma.folder.create({
    data: {
      name: 'Physics',
      ownerId: basicUser.id,
    }
  });

  const algebraSubFolder = await prisma.folder.create({
    data: {
      name: 'Linear Algebra',
      ownerId: basicUser.id,
      parentId: mathFolder.id,
    }
  });

  // 4. Create Scans
  const scan1 = await prisma.scan.create({
    data: {
      name: 'Matrix Multiplication Board',
      filePath: '/uploads/scans/matrix_mult.png',
      boardType: 'whiteboard',
      storageSize: 2048500, // ~2.04 MB
      ocrText: 'Matrix multiplication is a binary operation that produces a matrix from two matrices. For matrix A of size m x n and B of size n x p...',
      folderId: algebraSubFolder.id,
      ownerId: basicUser.id,
    }
  });

  const scan2 = await prisma.scan.create({
    data: {
      name: 'Newtonian Mechanics Laws',
      filePath: '/uploads/scans/newtonian_laws.png',
      boardType: 'blackboard',
      storageSize: 3400100, // ~3.4 MB
      ocrText: 'Newton\'s First Law: An object remains at rest, or in uniform motion... F = ma. Action equals Reaction.',
      folderId: physicsFolder.id,
      ownerId: basicUser.id,
    }
  });

  // 5. Create Sharing Relationship
  await prisma.share.create({
    data: {
      sharedById: basicUser.id,
      sharedToId: adminUser.id,
      folderId: mathFolder.id,
      permissionType: PermissionType.READ,
    }
  });

  // 6. Create Audit & Login Logs
  await prisma.loginHistory.createMany({
    data: [
      { userId: godUser.id, status: LoginStatus.SUCCESS, ipAddress: '127.0.0.1', userAgent: 'Postman/10.0.0' },
      { userId: adminUser.id, status: LoginStatus.SUCCESS, ipAddress: '192.168.1.10', userAgent: 'Android Mobile' },
      { userId: basicUser.id, status: LoginStatus.SUCCESS, ipAddress: '192.168.1.11', userAgent: 'Android Mobile' }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: godUser.id, action: 'CREATE_USER', details: 'God created Admin user' },
      { userId: basicUser.id, action: 'BOARD_CAPTURE', details: 'Successfully auto-captured Whiteboard scan in linear algebra folder' },
      { userId: basicUser.id, action: 'SHARE_FOLDER', details: 'Basic user shared Folder [Mathematics] with Admin user' }
    ]
  });

  console.log('Database successfully seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
