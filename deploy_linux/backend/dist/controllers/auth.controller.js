"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupPublic = exports.reportDeviceInfo = exports.getProfile = exports.registerUser = exports.login = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const login = async (req, res) => {
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
                    status: client_1.LoginStatus.FAILED,
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
                status: client_1.LoginStatus.SUCCESS,
                ipAddress,
                userAgent,
            }
        });
        // Create JWT
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.login = login;
const registerUser = async (req, res) => {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.registerUser = registerUser;
const getProfile = async (req, res) => {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getProfile = getProfile;
const reportDeviceInfo = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { deviceName, androidVersion, deviceModel, appVersion } = req.body;
    try {
        // Check if user already has a device record
        const existingDevice = await prisma.deviceInfo.findFirst({
            where: { userId: user.id }
        });
        if (existingDevice) {
            const updated = await prisma.deviceInfo.update({
                where: { id: existingDevice.id },
                data: {
                    deviceName: deviceName || existingDevice.deviceName,
                    androidVersion: androidVersion || existingDevice.androidVersion,
                    deviceModel: deviceModel || existingDevice.deviceModel,
                    appVersion: appVersion || existingDevice.appVersion,
                    syncStatus: 'Synced'
                }
            });
            return res.json(updated);
        }
        else {
            const newDevice = await prisma.deviceInfo.create({
                data: {
                    userId: user.id,
                    deviceName: deviceName || 'Unknown Device',
                    androidVersion: androidVersion || 'Unknown',
                    deviceModel: deviceModel || 'Unknown',
                    appVersion: appVersion || '1.0.0',
                    storageUsage: 0,
                    syncStatus: 'Synced'
                }
            });
            return res.json(newDevice);
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.reportDeviceInfo = reportDeviceInfo;
const signupPublic = async (req, res) => {
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
        const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.signupPublic = signupPublic;
