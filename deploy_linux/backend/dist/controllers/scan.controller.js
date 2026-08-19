"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareResource = exports.deleteScan = exports.getScans = exports.uploadScan = exports.createFolder = exports.getFolders = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Helper to determine accessible users' data based on the requesting user's role
const getAccessibleOwnerIds = async (userRole, userId) => {
    if (userRole === client_1.Role.GOD) {
        // God can access files from all users
        const allUsers = await prisma.user.findMany({ select: { id: true } });
        return allUsers.map(u => u.id);
    }
    else if (userRole === client_1.Role.ADMIN) {
        // Admin can access files owned by Basic Users, plus Admin's own files.
        // Admin CANNOT access files owned by God users or other Admins unless explicitly shared?
        // The prompt says: "Administrator has complete control over all Basic Users. Administrator can: View every file owned by every Basic User. Restrictions: Cannot access God files/folders."
        // So let's fetch all Basic Users plus the Admin's own ID.
        const basicUsers = await prisma.user.findMany({
            where: { role: client_1.Role.BASIC },
            select: { id: true }
        });
        return [...basicUsers.map(u => u.id), userId];
    }
    else {
        // Basic user can only access their own files
        return [userId];
    }
};
// List folders
const getFolders = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const parentId = req.query.parentId || null;
    try {
        const accessibleOwners = await getAccessibleOwnerIds(user.role, user.id);
        // Fetch folders owned by accessible users
        // Also include folders explicitly shared with the current user
        const folders = await prisma.folder.findMany({
            where: {
                parentId,
                isDeleted: false,
                OR: [
                    { ownerId: { in: accessibleOwners } },
                    { shares: { some: { sharedToId: user.id } } }
                ]
            },
            include: {
                owner: { select: { username: true, role: true } }
            },
            orderBy: { name: 'asc' }
        });
        return res.json(folders);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getFolders = getFolders;
// Create folder
const createFolder = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { name, parentId } = req.body;
    try {
        // If parent folder is specified, verify write access to it
        if (parentId) {
            const parentFolder = await prisma.folder.findUnique({ where: { id: parentId } });
            if (!parentFolder)
                return res.status(404).json({ error: 'Parent folder not found' });
            // Basic users can only write in their own folders or folders shared with write permissions
            if (user.role === client_1.Role.BASIC && parentFolder.ownerId !== user.id) {
                const share = await prisma.share.findFirst({
                    where: { folderId: parentId, sharedToId: user.id, permissionType: client_1.PermissionType.WRITE }
                });
                if (!share)
                    return res.status(403).json({ error: 'Forbidden: No write permission' });
            }
            // Admin check: Admin can write to Basic User folders. Admin cannot write to God folders.
            if (user.role === client_1.Role.ADMIN) {
                const folderOwner = await prisma.user.findUnique({ where: { id: parentFolder.ownerId } });
                if (folderOwner?.role === client_1.Role.GOD && parentFolder.ownerId !== user.id) {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.createFolder = createFolder;
// Upload scan (Image upload metadata registration)
const uploadScan = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { name, boardType, ocrText, folderId, storageSize, filePath } = req.body;
    try {
        if (folderId) {
            const folder = await prisma.folder.findUnique({ where: { id: folderId } });
            if (!folder)
                return res.status(404).json({ error: 'Folder not found' });
            // Permission check
            if (user.role === client_1.Role.BASIC && folder.ownerId !== user.id) {
                const share = await prisma.share.findFirst({
                    where: { folderId, sharedToId: user.id, permissionType: client_1.PermissionType.WRITE }
                });
                if (!share)
                    return res.status(403).json({ error: 'Forbidden: No write access' });
            }
            if (user.role === client_1.Role.ADMIN) {
                const folderOwner = await prisma.user.findUnique({ where: { id: folder.ownerId } });
                if (folderOwner?.role === client_1.Role.GOD) {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.uploadScan = uploadScan;
// List scans in a folder
const getScans = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const folderId = req.query.folderId || null;
    try {
        const accessibleOwners = await getAccessibleOwnerIds(user.role, user.id);
        // List scans
        // Either directly owned by accessible owners, or shared with user
        const scans = await prisma.scan.findMany({
            where: {
                folderId,
                isDeleted: false,
                OR: [
                    { ownerId: { in: accessibleOwners } },
                    { shares: { some: { sharedToId: user.id } } },
                    // If in a folder that is shared with the user
                    folderId ? { folder: { shares: { some: { sharedToId: user.id } } } } : {}
                ]
            },
            include: {
                owner: { select: { username: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(scans);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.getScans = getScans;
// Delete/Restore scan
const deleteScan = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { restore } = req.query; // query parameter ?restore=true
    try {
        const scan = await prisma.scan.findUnique({ where: { id } });
        if (!scan)
            return res.status(404).json({ error: 'Scan not found' });
        const fileOwner = await prisma.user.findUnique({ where: { id: scan.ownerId } });
        // Permissions check
        if (user.role === client_1.Role.BASIC && scan.ownerId !== user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (user.role === client_1.Role.ADMIN) {
            // Admin cannot delete God files
            if (fileOwner?.role === client_1.Role.GOD) {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.deleteScan = deleteScan;
// Create a sharing link
const shareResource = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { targetUsername, folderId, scanId, permissionType } = req.body;
    try {
        const targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
        if (!targetUser)
            return res.status(404).json({ error: 'Target user not found' });
        if (folderId) {
            const folder = await prisma.folder.findUnique({ where: { id: folderId } });
            if (!folder)
                return res.status(404).json({ error: 'Folder not found' });
            if (folder.ownerId !== user.id && user.role === client_1.Role.BASIC) {
                return res.status(403).json({ error: 'Forbidden: You must own the folder to share it' });
            }
        }
        if (scanId) {
            const scan = await prisma.scan.findUnique({ where: { id: scanId } });
            if (!scan)
                return res.status(404).json({ error: 'Scan not found' });
            if (scan.ownerId !== user.id && user.role === client_1.Role.BASIC) {
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
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
exports.shareResource = shareResource;
