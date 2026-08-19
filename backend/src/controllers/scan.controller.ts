import { Response } from 'express';
import { PrismaClient, PermissionType, Role } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

// Helper to determine accessible users' data based on the requesting user's role
const getAccessibleOwnerIds = async (userRole: Role, userId: string) => {
  if (userRole === Role.GOD) {
    // God can access files from all users
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    return allUsers.map(u => u.id);
  } else if (userRole === Role.ADMIN) {
    // Admin can access files owned by Basic Users, plus Admin's own files.
    // Admin CANNOT access files owned by God users or other Admins unless explicitly shared?
    // The prompt says: "Administrator has complete control over all Basic Users. Administrator can: View every file owned by every Basic User. Restrictions: Cannot access God files/folders."
    // So let's fetch all Basic Users plus the Admin's own ID.
    const basicUsers = await prisma.user.findMany({
      where: { role: Role.BASIC },
      select: { id: true }
    });
    return [...basicUsers.map(u => u.id), userId];
  } else {
    // Basic user can only access their own files
    return [userId];
  }
};

// List folders
export const getFolders = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const parentId = req.query.parentId as string || null;
  const targetUserId = req.query.targetUserId as string || null;

  try {
    const accessibleOwners = await getAccessibleOwnerIds(user.role, user.id);

    if (targetUserId && !accessibleOwners.includes(targetUserId)) {
      return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s files' });
    }

    const targetOwners = targetUserId ? [targetUserId] : accessibleOwners;

    // Fetch folders owned by target users
    // Also include folders explicitly shared with the current user
    const folders = await prisma.folder.findMany({
      where: {
        parentId,
        isDeleted: false,
        OR: [
          { ownerId: { in: targetOwners } },
          targetUserId ? {} : { shares: { some: { sharedToId: user.id } } }
        ]
      },
      include: {
        owner: { select: { username: true, role: true } }
      },
      orderBy: { name: 'asc' }
    });

    return res.json(folders);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Create folder
export const createFolder = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, parentId } = req.body;

  try {
    // If parent folder is specified, verify write access to it
    if (parentId) {
      const parentFolder = await prisma.folder.findUnique({ where: { id: parentId } });
      if (!parentFolder) return res.status(404).json({ error: 'Parent folder not found' });

      // Basic users can only write in their own folders or folders shared with write permissions
      if (user.role === Role.BASIC && parentFolder.ownerId !== user.id) {
        const share = await prisma.share.findFirst({
          where: { folderId: parentId, sharedToId: user.id, permissionType: PermissionType.WRITE }
        });
        if (!share) return res.status(403).json({ error: 'Forbidden: No write permission' });
      }

      // Admin check: Admin can write to Basic User folders. Admin cannot write to God folders.
      if (user.role === Role.ADMIN) {
        const folderOwner = await prisma.user.findUnique({ where: { id: parentFolder.ownerId } });
        if (folderOwner?.role === Role.GOD && parentFolder.ownerId !== user.id) {
          return res.status(403).json({ error: 'Forbidden: Admins cannot write to God folders' });
        }
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        ownerId: user.id,
        parentId: parentId || null
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE_FOLDER',
        details: `Created folder "${name}" (ID: ${folder.id})`,
      }
    });

    return res.status(201).json(folder);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Upload scan (Image upload metadata registration)
export const uploadScan = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, boardType, ocrText, folderId, storageSize, filePath } = req.body;

  try {
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      // Permission check
      if (user.role === Role.BASIC && folder.ownerId !== user.id) {
        const share = await prisma.share.findFirst({
          where: { folderId, sharedToId: user.id, permissionType: PermissionType.WRITE }
        });
        if (!share) return res.status(403).json({ error: 'Forbidden: No write access' });
      }

      if (user.role === Role.ADMIN) {
        const folderOwner = await prisma.user.findUnique({ where: { id: folder.ownerId } });
        if (folderOwner?.role === Role.GOD) {
          return res.status(403).json({ error: 'Forbidden: Admins cannot upload to God folders' });
        }
      }
    }

    const scan = await prisma.scan.create({
      data: {
        name,
        filePath: filePath || '/uploads/scans/dummy.png',
        boardType: boardType || 'whiteboard',
        storageSize: storageSize || 1000000, // default 1MB
        ocrText: ocrText || '',
        folderId: folderId || null,
        ownerId: user.id,
      }
    });

    // Update DeviceInfo storage usage if exists
    const deviceInfo = await prisma.deviceInfo.findFirst({ where: { userId: user.id } });
    if (deviceInfo) {
      await prisma.deviceInfo.update({
        where: { id: deviceInfo.id },
        data: { storageUsage: deviceInfo.storageUsage + BigInt(scan.storageSize) }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'BOARD_CAPTURE',
        details: `Scanned whiteboard "${name}" (${scan.storageSize} bytes)`,
      }
    });

    return res.status(201).json(scan);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// List scans in a folder
export const getScans = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const folderId = req.query.folderId as string || null;
  const targetUserId = req.query.targetUserId as string || null;

  try {
    const accessibleOwners = await getAccessibleOwnerIds(user.role, user.id);

    if (targetUserId && !accessibleOwners.includes(targetUserId)) {
      return res.status(403).json({ error: 'Forbidden: Cannot access this user\'s files' });
    }

    const targetOwners = targetUserId ? [targetUserId] : accessibleOwners;

    // List scans
    // Either directly owned by accessible owners, or shared with user
    const scans = await prisma.scan.findMany({
      where: {
        folderId,
        isDeleted: false,
        OR: [
          { ownerId: { in: targetOwners } },
          targetUserId ? {} : { shares: { some: { sharedToId: user.id } } },
          // If in a folder that is shared with the user
          (folderId && !targetUserId) ? { folder: { shares: { some: { sharedToId: user.id } } } } : {}
        ]
      },
      include: {
        owner: { select: { username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(scans);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Delete/Restore scan
export const deleteScan = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { restore } = req.query; // query parameter ?restore=true

  try {
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const fileOwner = await prisma.user.findUnique({ where: { id: scan.ownerId } });

    // Permissions check
    if (user.role === Role.BASIC && scan.ownerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (user.role === Role.ADMIN) {
      // Admin cannot delete God files
      if (fileOwner?.role === Role.GOD) {
        return res.status(403).json({ error: 'Forbidden: Admins cannot delete God scans' });
      }
    }

    const updatedScan = await prisma.scan.update({
      where: { id },
      data: { isDeleted: restore === 'true' ? false : true }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: restore === 'true' ? 'RESTORE_SCAN' : 'DELETE_SCAN',
        details: `${restore === 'true' ? 'Restored' : 'Deleted'} scan "${scan.name}"`,
      }
    });

    return res.json({ message: `Scan successfully ${restore === 'true' ? 'restored' : 'deleted'}`, scan: updatedScan });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Create a sharing link
export const shareResource = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { targetUsername, folderId, scanId, permissionType } = req.body;

  try {
    const targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      if (folder.ownerId !== user.id && user.role === Role.BASIC) {
        return res.status(403).json({ error: 'Forbidden: You must own the folder to share it' });
      }
    }

    if (scanId) {
      const scan = await prisma.scan.findUnique({ where: { id: scanId } });
      if (!scan) return res.status(404).json({ error: 'Scan not found' });
      if (scan.ownerId !== user.id && user.role === Role.BASIC) {
        return res.status(403).json({ error: 'Forbidden: You must own the scan to share it' });
      }
    }

    const share = await prisma.share.create({
      data: {
        sharedById: user.id,
        sharedToId: targetUser.id,
        folderId: folderId || null,
        scanId: scanId || null,
        permissionType: permissionType || 'READ',
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SHARE_RESOURCE',
        details: `Shared resource with ${targetUsername} (Permission: ${permissionType})`,
      }
    });

    return res.status(201).json(share);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
