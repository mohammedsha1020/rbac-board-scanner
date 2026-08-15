import { Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

// User management endpoints
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (user.role === Role.GOD) {
      // God can see ALL users (God, Admins, Basic Users)
      const allUsers = await prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, isEnabled: true, isLocked: true, createdAt: true }
      });
      return res.json(allUsers);
    } else if (user.role === Role.ADMIN) {
      // Admin can ONLY see Basic Users
      const basicUsers = await prisma.user.findMany({
        where: { role: Role.BASIC },
        select: { id: true, username: true, email: true, role: true, isEnabled: true, isLocked: true, createdAt: true }
      });
      return res.json(basicUsers);
    } else {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Lock/Unlock accounts or Toggle Enable
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { isLocked, isEnabled } = req.body;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Validate permission boundary
    if (user.role === Role.ADMIN) {
      // Admin can only toggle status of Basic Users. Cannot toggle status of God or other Admins.
      if (targetUser.role !== Role.BASIC) {
        return res.status(403).json({ error: 'Forbidden: Administrators cannot modify other Admin or God permissions' });
      }
    }

    const data: any = {};
    if (isLocked !== undefined) data.isLocked = isLocked;
    if (isEnabled !== undefined) data.isEnabled = isEnabled;

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, isLocked: true, isEnabled: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE_USER_STATUS',
        details: `Updated status of user "${targetUser.username}". Locked: ${isLocked ?? targetUser.isLocked}. Enabled: ${isEnabled ?? targetUser.isEnabled}`,
      }
    });

    return res.json(updatedUser);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Reset any password
export const resetUserPassword = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Validate permission boundary
    if (user.role === Role.ADMIN) {
      if (targetUser.role !== Role.BASIC) {
        return res.status(403).json({ error: 'Forbidden: Administrators can only reset Basic User passwords' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RESET_PASSWORD',
        details: `Reset password for user "${targetUser.username}"`,
      }
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// View device telemetry
export const getDeviceTelemetry = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (user.role === Role.GOD) {
      const telemetry = await prisma.deviceInfo.findMany({
        include: { user: { select: { username: true, role: true } } }
      });
      // Convert BigInt to string to avoid JSON errors
      const result = telemetry.map(t => ({
        ...t,
        storageUsage: t.storageUsage.toString()
      }));
      return res.json(result);
    } else if (user.role === Role.ADMIN) {
      // Admin sees telemetry for Basic Users only
      const telemetry = await prisma.deviceInfo.findMany({
        where: { user: { role: Role.BASIC } },
        include: { user: { select: { username: true, role: true } } }
      });
      const result = telemetry.map(t => ({
        ...t,
        storageUsage: t.storageUsage.toString()
      }));
      return res.json(result);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// View Logs (GOD only)
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (user.role !== Role.GOD) {
    return res.status(403).json({ error: 'Forbidden: Audit Logs are only visible to L3 God accounts' });
  }

  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// View Login History (ADMIN & GOD)
export const getLoginHistory = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (user.role === Role.GOD) {
      const history = await prisma.loginHistory.findMany({
        include: { user: { select: { username: true, role: true } } },
        orderBy: { timestamp: 'desc' },
        take: 200
      });
      return res.json(history);
    } else if (user.role === Role.ADMIN) {
      // Admin only sees logins of Basic Users
      const history = await prisma.loginHistory.findMany({
        where: { user: { role: Role.BASIC } },
        include: { user: { select: { username: true, role: true } } },
        orderBy: { timestamp: 'desc' },
        take: 200
      });
      return res.json(history);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// View sharing logs (ADMIN and GOD)
export const getSharingLogs = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (user.role === Role.GOD) {
      const shares = await prisma.share.findMany({
        include: {
          sharedBy: { select: { username: true } },
          sharedTo: { select: { username: true } },
          folder: { select: { name: true } },
          scan: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(shares);
    } else if (user.role === Role.ADMIN) {
      // Admin sees shares involving Basic Users
      const shares = await prisma.share.findMany({
        where: {
          OR: [
            { sharedBy: { role: Role.BASIC } },
            { sharedTo: { role: Role.BASIC } }
          ]
        },
        include: {
          sharedBy: { select: { username: true } },
          sharedTo: { select: { username: true } },
          folder: { select: { name: true } },
          scan: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(shares);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
