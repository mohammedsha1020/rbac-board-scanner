const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Virtual database in-memory state
let db = {
  users: [
    { id: "u1", username: "basic_john", email: "john@student.edu", role: "BASIC", isLocked: false, isEnabled: true },
    { id: "u2", username: "basic_emma", email: "emma@student.edu", role: "BASIC", isLocked: true, isEnabled: true },
    { id: "u3", username: "admin_clark", email: "clark@admin.app", role: "ADMIN", isLocked: false, isEnabled: true },
    { id: "u4", username: "god_system", email: "god@system.app", role: "GOD", isLocked: false, isEnabled: true }
  ],
  folders: [
    { id: "f1", name: "Mathematics", parentId: null, ownerId: "u1" },
    { id: "f2", name: "Physics", parentId: null, ownerId: "u1" },
    { id: "f3", name: "Linear Algebra", parentId: "f1", ownerId: "u1" },
    { id: "f4", name: "Quantum Mechanics", parentId: "f2", ownerId: "u1" },
    { id: "f5", name: "Admin Handbooks", parentId: null, ownerId: "u3" },
    { id: "f6", name: "God Access Vault", parentId: null, ownerId: "u4" }
  ],
  scans: [
    { id: "s1", name: "Matrix Transformations", folderId: "f3", ownerId: "u1", size: "2.1 MB", type: "whiteboard", date: "2026-07-28 14:02" },
    { id: "s2", name: "Newtonian Equations", folderId: "f2", ownerId: "u1", size: "3.4 MB", type: "blackboard", date: "2026-07-28 15:30" },
    { id: "s3", name: "Security Checklists", folderId: "f5", ownerId: "u3", size: "900 KB", type: "document", date: "2026-07-28 16:15" },
    { id: "s4", name: "Core Kernel Configs", folderId: "f6", ownerId: "u4", size: "1.2 MB", type: "slide", date: "2026-07-28 17:44" }
  ],
  shares: [
    { id: "sh1", sharedBy: "basic_john", sharedTo: "admin_clark", item: "Mathematics (Folder)", permission: "READ" }
  ],
  devices: [
    { id: "d1", userId: "u1", username: "basic_john", device: "Samsung Galaxy S24 Ultra", model: "SM-S928B", os: "Android 14 (API 34)", app: "1.0.0+1", storage: "24.5 MB", sync: "Synced" },
    { id: "d2", userId: "u2", username: "basic_emma", device: "Google Pixel 8 Pro", model: "GC3VE", os: "Android 14 (API 34)", app: "1.0.0+1", storage: "12.8 MB", sync: "Pending" },
    { id: "d3", userId: "u3", username: "admin_clark", device: "OnePlus 12", model: "CPH2581", os: "Android 13 (API 33)", app: "1.0.0+1", storage: "2.4 MB", sync: "Synced" }
  ],
  auditLogs: [
    { id: "l1", time: "18:01:22", user: "god_system", action: "CREATE_USER", details: "Promoted Clark to ADMIN" },
    { id: "l2", time: "17:45:10", user: "basic_emma", action: "LOGIN_FAIL", details: "Failed login attempt (x3) - Lock Applied" },
    { id: "l3", time: "16:22:15", user: "basic_john", action: "BOARD_CAPTURE", details: "Uploaded scan 'Matrix Transformations'" },
    { id: "l4", time: "15:10:04", user: "admin_clark", action: "SHARE_REVOKE", details: "Revoked read share on 'Math folder'" }
  ]
};

// API Endpoints for simulation
app.get('/api/sim/data', (req, res) => {
  res.json(db);
});

// Create audit log
app.post('/api/sim/log', (req, res) => {
  const { user, action, details } = req.body;
  const time = new Date().toLocaleTimeString();
  const newLog = { id: 'l_' + Date.now(), time, user, action, details };
  db.auditLogs.unshift(newLog);
  res.status(201).json(newLog);
});

// Update user status
app.post('/api/sim/users/status', (req, res) => {
  const { userId, isLocked, isEnabled, actor } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (user) {
    if (isLocked !== undefined) user.isLocked = isLocked;
    if (isEnabled !== undefined) user.isEnabled = isEnabled;

    const time = new Date().toLocaleTimeString();
    db.auditLogs.unshift({
      id: 'l_' + Date.now(),
      time,
      user: actor,
      action: "USER_LOCKOUT_UPDATE",
      details: `Modified user status for "${user.username}". Locked: ${user.isLocked}, Enabled: ${user.isEnabled}`
    });
    return res.json({ success: true, user });
  }
  res.status(404).json({ error: 'User not found' });
});

// Reset password
app.post('/api/sim/users/reset', (req, res) => {
  const { userId, actor } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (user) {
    const time = new Date().toLocaleTimeString();
    db.auditLogs.unshift({
      id: 'l_' + Date.now(),
      time,
      user: actor,
      action: "RESET_PASSWORD",
      details: `Reset password parameters for user "${user.username}"`
    });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'User not found' });
});

// Delete file
app.post('/api/sim/scans/delete', (req, res) => {
  const { scanId, actor } = req.body;
  const scanIndex = db.scans.findIndex(s => s.id === scanId);
  if (scanIndex !== -1) {
    const scan = db.scans[scanIndex];
    db.scans.splice(scanIndex, 1);

    const time = new Date().toLocaleTimeString();
    db.auditLogs.unshift({
      id: 'l_' + Date.now(),
      time,
      user: actor,
      action: "DELETE_SCAN",
      details: `Deleted scan "${scan.name}" owned by "${db.users.find(u => u.id === scan.ownerId)?.username || 'unknown'}"`
    });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Scan not found' });
});

// Save file
app.post('/api/sim/scans/save', (req, res) => {
  const { name, folderId, size, type, actor } = req.body;
  const newScan = {
    id: 's_' + Date.now(),
    name,
    folderId,
    ownerId: "u1", // defaults to basic john for demo
    size,
    type,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16)
  };
  db.scans.push(newScan);
  
  const time = new Date().toLocaleTimeString();
  db.auditLogs.unshift({
    id: 'l_' + Date.now(),
    time,
    user: actor,
    action: "BOARD_CAPTURE",
    details: `Successfully auto-captured and saved "${name}" (${size})`
  });
  
  res.status(201).json(newScan);
});

app.listen(PORT, () => {
  console.log(`Demo Simulation running at http://localhost:${PORT}`);
});
