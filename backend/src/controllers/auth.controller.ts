import { Response } from 'express';
import { PrismaClient, LoginStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

export const login = async (req: AuthenticatedRequest, res: Response) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isEnabled) {
      return res.status(403).json({ error: 'Account is disabled. Please contact your administrator.' });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: 'Account is locked due to security protocols.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // Log failed login
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          status: LoginStatus.FAILED,
          ipAddress,
          userAgent,
        }
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Log successful login
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        status: LoginStatus.SUCCESS,
        ipAddress,
        userAgent,
      }
    });

    // Create JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: `User logged in with role ${user.role}`,
        ipAddress,
        userAgent,
      }
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const registerUser = async (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, role } = req.body;
  const requestingUser = req.user; // L2 or L3 who is creating this user

  try {
    if (!requestingUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Role creation validation
    // Basic user creation requires L2 or L3. Admin user creation requires L3. God user creation is not possible via API (must be done in seed/DB directly or only by L3)
    if (role === 'ADMIN' && requestingUser.role !== 'GOD') {
      return res.status(403).json({ error: 'Only GOD level accounts can create Administrators' });
    }
    if (role === 'GOD') {
      return res.status(403).json({ error: 'GOD accounts cannot be created via standard registrations' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: role || 'BASIC',
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: requestingUser.id,
        action: 'CREATE_USER',
        details: `Created user ${username} with role ${role || 'BASIC'}`,
      }
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const signupPublic = async (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'BASIC',
      }
    });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
