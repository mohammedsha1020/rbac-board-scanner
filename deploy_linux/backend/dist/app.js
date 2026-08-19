"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middlewares/auth");
const auth_controller_1 = require("./controllers/auth.controller");
const scan_controller_1 = require("./controllers/scan.controller");
const admin_controller_1 = require("./controllers/admin.controller");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Public Auth Routes & Aliases
app.post('/api/auth/login', auth_controller_1.login);
app.post('/auth/login', auth_controller_1.login);
app.post('/login', auth_controller_1.login);
app.post('/api/auth/register', auth_controller_1.signupPublic);
app.post('/auth/register', auth_controller_1.signupPublic);
app.post('/register', auth_controller_1.signupPublic);
app.post('/api/auth/signup', auth_controller_1.signupPublic);
app.post('/signup', auth_controller_1.signupPublic);
// Helpful GET messages for browser testing
app.get('/api/auth/login', (req, res) => res.json({ message: "Auth login endpoint active. Send a POST request with username and password." }));
app.get('/api/auth/register', (req, res) => res.json({ message: "Auth register endpoint active. Send a POST request with username, email, and password." }));
// Authenticated general routes
app.get('/api/auth/profile', auth_1.authenticateToken, auth_controller_1.getProfile);
app.get('/auth/profile', auth_1.authenticateToken, auth_controller_1.getProfile);
// Scanner & Folder routes (L1, L2, L3)
app.get('/api/folders', auth_1.authenticateToken, scan_controller_1.getFolders);
app.post('/api/folders', auth_1.authenticateToken, scan_controller_1.createFolder);
app.get('/api/scans', auth_1.authenticateToken, scan_controller_1.getScans);
app.post('/api/scans', auth_1.authenticateToken, scan_controller_1.uploadScan);
app.delete('/api/scans/:id', auth_1.authenticateToken, scan_controller_1.deleteScan);
app.post('/api/shares', auth_1.authenticateToken, scan_controller_1.shareResource);
// Admin & God routes (L2 & L3)
app.get('/api/admin/users', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.getUsers);
app.post('/api/admin/users', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), auth_controller_1.registerUser);
app.put('/api/admin/users/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.updateUserStatus);
app.post('/api/admin/users/:id/reset-password', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.resetUserPassword);
app.get('/api/admin/devices', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.getDeviceTelemetry);
app.get('/api/admin/login-history', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.getLoginHistory);
app.get('/api/admin/shares', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'GOD']), admin_controller_1.getSharingLogs);
// God-only routes (L3)
app.get('/api/admin/audit-logs', auth_1.authenticateToken, (0, auth_1.requireRole)(['GOD']), admin_controller_1.getAuditLogs);
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
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Server error')
    });
});
exports.default = app;
