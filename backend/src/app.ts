import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authenticateToken, requireRole } from './middlewares/auth';
import { login, registerUser, signupPublic, getProfile, reportDeviceInfo } from './controllers/auth.controller';
import { getFolders, createFolder, uploadScan, getScans, deleteScan, shareResource } from './controllers/scan.controller';
import { 
  getUsers, 
  updateUserStatus, 
  resetUserPassword, 
  getDeviceTelemetry, 
  getAuditLogs, 
  getLoginHistory,
  getSharingLogs
} from './controllers/admin.controller';
import { getRemoteDirectory, requestRemoteFile, uploadRemoteFile } from './controllers/remote.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Setup multer for remote uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for remote files
});

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public Auth Routes & Aliases
app.post('/api/auth/login', login);
app.post('/auth/login', login);
app.post('/login', login);

app.post('/api/auth/register', signupPublic);
app.post('/auth/register', signupPublic);
app.post('/register', signupPublic);
app.post('/api/auth/signup', signupPublic);
app.post('/signup', signupPublic);

// Helpful GET messages for browser testing
app.get('/api/auth/login', (req, res) => res.json({ message: "Auth login endpoint active. Send a POST request with username and password." }));
app.get('/api/auth/register', (req, res) => res.json({ message: "Auth register endpoint active. Send a POST request with username, email, and password." }));

// Authenticated general routes
app.get('/api/auth/profile', authenticateToken, getProfile);
app.get('/auth/profile', authenticateToken, getProfile);
app.post('/api/auth/device', authenticateToken, reportDeviceInfo);

// Scanner & Folder routes (L1, L2, L3)
app.get('/api/folders', authenticateToken, getFolders);
app.post('/api/folders', authenticateToken, createFolder);
app.get('/api/scans', authenticateToken, getScans);
app.post('/api/scans', authenticateToken, uploadScan);
app.delete('/api/scans/:id', authenticateToken, deleteScan);
app.post('/api/shares', authenticateToken, shareResource);

// Admin & God routes (L2 & L3)
app.get('/api/admin/users', authenticateToken, requireRole(['ADMIN', 'GOD']), getUsers);
app.post('/api/admin/users', authenticateToken, requireRole(['ADMIN', 'GOD']), registerUser);
app.put('/api/admin/users/:id', authenticateToken, requireRole(['ADMIN', 'GOD']), updateUserStatus);
app.post('/api/admin/users/:id/reset-password', authenticateToken, requireRole(['ADMIN', 'GOD']), resetUserPassword);
app.get('/api/admin/devices', authenticateToken, requireRole(['ADMIN', 'GOD']), getDeviceTelemetry);
app.get('/api/admin/login-history', authenticateToken, requireRole(['ADMIN', 'GOD']), getLoginHistory);
app.get('/api/admin/shares', authenticateToken, requireRole(['ADMIN', 'GOD']), getSharingLogs);

// Remote File Explorer Routes
app.get('/api/admin/remote-dir', authenticateToken, requireRole(['ADMIN', 'GOD']), getRemoteDirectory);
app.post('/api/admin/remote-file', authenticateToken, requireRole(['ADMIN', 'GOD']), requestRemoteFile);
app.post('/api/remote/upload', authenticateToken, upload.single('remoteFile'), uploadRemoteFile);

// God-only routes (L3)
app.get('/api/admin/audit-logs', authenticateToken, requireRole(['GOD']), getAuditLogs);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RBAC Board Scanner Backend Server is Online' });
});

// 404 Fallback JSON Handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.path} not found` });
});

// Centralized Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Server error')
  });
});

export default app;
