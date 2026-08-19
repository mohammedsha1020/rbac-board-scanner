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
exports.getSharingLogs = exports.getLoginHistory = exports.getAuditLogs = exports.getDeviceTelemetry = exports.resetUserPassword = exports.updateUserStatus = exports.getUsers = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
// User management endpoints
const getUsers = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        if (user.role === client_1.Role.GOD) {
            // God can see ALL users (God, Admins, Basic Users)
            const allUsers = await prisma.user.findMany({
                select: { id: true, username: true, email: true, role: true, isEnabled: true, isLocked: true, createdAt: true }
            });
            return res.json(allUsers);
        }
        else if (user.role === client_1.Role.ADMIN) {
            // Admin can ONLY see Basic Users
            const basicUsers = await prisma.user.findMany({
                where: { role: client_1.Role.BASIC },
                select: { id: true, username: true, email: true, role: true, isEnabled: true, isLocked: true, createdAt: true }
            });
            return res.json(basicUsers);
        }
        else {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getUsers = getUsers;
// Lock/Unlock accounts or Toggle Enable
const updateUserStatus = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { isLocked, isEnabled } = req.body;
    try {
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser)
            return res.status(404).json({ error: 'User not found' });
        // Validate permission boundary
        if (user.role === client_1.Role.ADMIN) {
            // Admin can only toggle status of Basic Users. Cannot toggle status of God or other Admins.
            if (targetUser.role !== client_1.Role.BASIC) {
                return res.status(403).json({ error: 'Forbidden: Administrators cannot modify other Admin or God permissions' });
            }
        }
        const data = {};
        if (isLocked !== undefined)
            data.isLocked = isLocked;
        if (isEnabled !== undefined)
            data.isEnabled = isEnabled;
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.updateUserStatus = updateUserStatus;
// Reset any password
const resetUserPassword = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { newPassword } = req.body;
    try {
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser)
            return res.status(404).json({ error: 'User not found' });
        // Validate permission boundary
        if (user.role === client_1.Role.ADMIN) {
            if (targetUser.role !== client_1.Role.BASIC) {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.resetUserPassword = resetUserPassword;
// View device telemetry
const getDeviceTelemetry = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        if (user.role === client_1.Role.GOD) {
            const telemetry = await prisma.deviceInfo.findMany({
                include: { user: { select: { username: true, role: true } } }
            });
            // Convert BigInt to string to avoid JSON errors
            const result = telemetry.map(t => ({
                ...t,
                storageUsage: t.storageUsage.toString()
            }));
            return res.json(result);
        }
        else if (user.role === client_1.Role.ADMIN) {
            // Admin sees telemetry for Basic Users only
            const telemetry = await prisma.deviceInfo.findMany({
                where: { user: { role: client_1.Role.BASIC } },
                include: { user: { select: { username: true, role: true } } }
            });
            const result = telemetry.map(t => ({
                ...t,
                storageUsage: t.storageUsage.toString()
            }));
            return res.json(result);
        }
        else {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getDeviceTelemetry = getDeviceTelemetry;
// View Logs (GOD only)
const getAuditLogs = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== client_1.Role.GOD) {
        return res.status(403).json({ error: 'Forbidden: Audit Logs are only visible to L3 God accounts' });
    }
    try {
        const logs = await prisma.auditLog.findMany({
            include: { user: { select: { username: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        return res.json(logs);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getAuditLogs = getAuditLogs;
// View Login History (ADMIN & GOD)
const getLoginHistory = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        if (user.role === client_1.Role.GOD) {
            const history = await prisma.loginHistory.findMany({
                include: { user: { select: { username: true, role: true } } },
                orderBy: { timestamp: 'desc' },
                take: 200
            });
            return res.json(history);
        }
        else if (user.role === client_1.Role.ADMIN) {
            // Admin only sees logins of Basic Users
            const history = await prisma.loginHistory.findMany({
                where: { user: { role: client_1.Role.BASIC } },
                include: { user: { select: { username: true, role: true } } },
                orderBy: { timestamp: 'desc' },
                take: 200
            });
            return res.json(history);
        }
        else {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getLoginHistory = getLoginHistory;
// View sharing logs (ADMIN and GOD)
const getSharingLogs = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        if (user.role === client_1.Role.GOD) {
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
        }
        else if (user.role === client_1.Role.ADMIN) {
            // Admin sees shares involving Basic Users
            const shares = await prisma.share.findMany({
                where: {
                    OR: [
                        { sharedBy: { role: client_1.Role.BASIC } },
                        { sharedTo: { role: client_1.Role.BASIC } }
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
        }
        else {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getSharingLogs = getSharingLogs;
