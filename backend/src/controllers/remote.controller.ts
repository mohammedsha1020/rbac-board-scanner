import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ioInstance, getSocketIdForUser, pendingRequests } from '../sockets';
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export const getRemoteDirectory = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user || user.role === Role.BASIC) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { targetUserId, path } = req.query as { targetUserId: string, path?: string };
  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }

  const socketId = getSocketIdForUser(targetUserId);
  if (!socketId) {
    return res.status(404).json({ error: 'Target device is currently offline' });
  }

  const reqId = uuidv4();
  
  // Set up a promise to wait for the device's response via socket
  const resultPromise = new Promise((resolve) => {
    pendingRequests.set(reqId, resolve);
    // Timeout after 15 seconds
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        resolve({ error: 'Device timeout' });
      }
    }, 15000);
  });

  // Emit the request to the target device
  ioInstance?.to(socketId).emit('req_dir', { reqId, path: path || '/storage/emulated/0' });

  const result: any = await resultPromise;
  
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  return res.json(result.files);
};

export const requestRemoteFile = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user || user.role === Role.BASIC) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { targetUserId, filePath } = req.body;
  if (!targetUserId || !filePath) {
    return res.status(400).json({ error: 'targetUserId and filePath are required' });
  }

  const socketId = getSocketIdForUser(targetUserId);
  if (!socketId) {
    return res.status(404).json({ error: 'Target device is currently offline' });
  }

  // To keep it simple: tell the target device to upload the file to a presigned URL or our server,
  // then we return that URL to the admin.
  // We'll tell the device to upload via standard HTTP POST, and socket responds when done.
  const reqId = uuidv4();
  
  const resultPromise = new Promise((resolve) => {
    pendingRequests.set(reqId, resolve);
    setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        resolve({ error: 'Device timeout or upload failed' });
      }
    }, 60000); // 60s for file uploads
  });

  ioInstance?.to(socketId).emit('req_file', { reqId, filePath });

  const result: any = await resultPromise;
  
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  // Device uploaded the file, return the remote URL to the admin
  return res.json({ url: result.url });
};

// Endpoint for the target device to upload the requested file
export const uploadRemoteFile = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const reqId = req.body.reqId;
  const file = req.file;

  if (!reqId || !file) {
    return res.status(400).json({ error: 'reqId and file are required' });
  }

  // Assuming file is uploaded using multer and available in 'uploads/'
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

  // Resolve the pending request for the admin
  const resolver = pendingRequests.get(reqId);
  if (resolver) {
    resolver({ url: fileUrl });
    pendingRequests.delete(reqId);
  }

  return res.json({ success: true, url: fileUrl });
};
