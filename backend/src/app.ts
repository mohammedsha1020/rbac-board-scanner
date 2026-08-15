import express from 'express';
import cors from 'cors';
import { authenticateToken, requireRole } from './middlewares/auth';
import { login, registerUser, getProfile } from './controllers/auth.controller';
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

const app = express();

app.use(cors());
app.use(express.json());

// Public routes
app.post('/api/auth/login', login);

// Authenticated general routes
app.get('/api/auth/profile', authenticateToken, getProfile);

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

// God-only routes (L3)
app.get('/api/admin/audit-logs', authenticateToken, requireRole(['GOD']), getAuditLogs);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
