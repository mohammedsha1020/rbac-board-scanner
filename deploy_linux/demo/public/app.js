// State Variables
let currentRole = 'BASIC'; // BASIC | ADMIN | GOD
let currentFolderId = null;
let captureMode = 'auto';
let activeConsoleTab = 'users';
let currentPhoneTab = 'scanner';

let currentBoardType = 'whiteboard'; // whiteboard | blackboard | slide | document
let dbData = {};

// File manager specific state
let selectedSandboxUserId = 'u1'; // basic_john by default
let phoneSearchQuery = '';
let activeActionItemId = null;
let activeActionItemName = '';
let activeActionItemIsFolder = false;

// Android system explorer state (A to Z)
let activeFileSystemTab = 0; // 0: App Sandbox, 1: Device Storage
let deviceExplorerCurrentPath = '/storage/emulated/0';

// Canvas variables
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');

// On Initial Load
window.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  refreshData();
  startClock();
  
  // Set window resize listener to keep canvas sized right
  window.addEventListener('resize', drawSimulatedBoard);
});

// Real-time time updater in phone top bar
function startClock() {
  const clockEl = document.getElementById('phone-time');
  if (!clockEl) return;
  const updateTime = () => {
    const now = new Date();
    let hours = now.getHours().toString().padStart(2, '0');
    let minutes = now.getMinutes().toString().padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
  };
  updateTime();
  setInterval(updateTime, 60000);
}

// Fetch DB information from Node server
async function refreshData() {
  try {
    const res = await fetch('/api/sim/data');
    dbData = await res.json();
    
    updateConsoleDashboard();
    updatePhoneFolders();
  } catch (err) {
    console.error("Failed to load db data:", err);
  }
}

// Draw the simulated board onto the HTML5 Canvas
function initCanvas() {
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth || 320;
  canvas.height = canvas.parentElement.clientHeight || 450;
  drawSimulatedBoard();
}

function toggleScannerSubjectBoard() {
  const types = ['whiteboard', 'blackboard', 'slide', 'document'];
  const nextIdx = (types.indexOf(currentBoardType) + 1) % types.length;
  currentBoardType = types[nextIdx];
  
  const stabilizeText = document.getElementById('stabilize-text');
  stabilizeText.textContent = `Auto-detecting ${currentBoardType} boundaries...`;
  
  drawSimulatedBoard();
}

function drawSimulatedBoard() {
  if (!canvas || !ctx) return;
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Clear
  ctx.clearRect(0, 0, w, h);
  
  // 1. Draw raw canvas background depending on board type
  let bgGradient = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w);
  
  if (currentBoardType === 'whiteboard') {
    bgGradient.addColorStop(0, '#f8fafc'); // White
    bgGradient.addColorStop(1, '#94a3b8'); // Dark grey shadow in corner
  } else if (currentBoardType === 'blackboard') {
    bgGradient.addColorStop(0, '#064e3b'); // Dusty Green
    bgGradient.addColorStop(1, '#022c22'); // Dark corner shadow
  } else if (currentBoardType === 'slide') {
    bgGradient.addColorStop(0, '#eff6ff'); // Blueish projection
    bgGradient.addColorStop(1, '#3b82f6'); // Vignette
  } else { // document
    bgGradient.addColorStop(0, '#fffdf5'); // Cream paper
    bgGradient.addColorStop(1, '#d97706'); // Shadow
  }
  
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);
  
  // 2. Draw Simulated Glare (White hotspot in upper left)
  ctx.save();
  let glareGrad = ctx.createRadialGradient(w * 0.25, h * 0.25, 5, w * 0.25, h * 0.25, w * 0.5);
  glareGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  glareGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glareGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 3. Draw Board Boundaries
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = currentBoardType === 'whiteboard' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  ctx.strokeRect(w*0.08, h*0.12, w*0.84, h*0.76);
  ctx.restore();

  // 4. Draw Simulated Handwritten Text & Equations
  ctx.save();
  ctx.translate(w*0.12, h*0.25);
  ctx.rotate(-0.01);
  
  if (currentBoardType === 'whiteboard') {
    ctx.font = 'bold 15px "Outfit"';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText("Linear System Matrix:", 10, 20);
    ctx.font = '14px "Outfit"';
    ctx.fillText("[ 3  -1   4 ]   [ x ]     [  5 ]", 15, 50);
    ctx.fillText("[ 1   2   0 ] * [ y ]  =  [  8 ]", 15, 75);
    ctx.fillText("[ 0  -3   2 ]   [ z ]     [ -2 ]", 15, 100);
    ctx.fillStyle = '#b91c1c';
    ctx.fillText("Find Eigenvalues λ !", 10, 140);
  } else if (currentBoardType === 'blackboard') {
    ctx.font = 'bold 16px "Outfit"';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText("Quantum Mechanics:", 10, 20);
    ctx.font = '15px "Outfit"';
    ctx.fillText("Ĥψ = Eψ", 15, 55);
    ctx.fillText("-ħ²/2m * ∂²ψ/∂x² + Vψ = Eψ", 15, 90);
    ctx.fillStyle = '#fef08a';
    ctx.fillText("Normalization: ∫|ψ|² dx = 1", 10, 140);
  } else if (currentBoardType === 'slide') {
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText("Deep Learning Models", 10, 20);
    ctx.font = '13px Arial';
    ctx.fillText("• Feed-forward networks (MLP)", 15, 55);
    ctx.fillText("• Convolutional networks (CNN)", 15, 80);
    ctx.fillText("• Recurrent architectures (RNN)", 15, 105);
  } else {
    ctx.font = '11px serif';
    ctx.fillStyle = '#111827';
    ctx.fillText("Section 1.1: Background context", 10, 20);
    ctx.fillText("Document scans require perspective alignment", 10, 45);
    ctx.fillText("and text sharpening for OCR accuracy.", 10, 65);
    ctx.fillText("Storage is optimized through byte compression.", 10, 85);
  }
  ctx.restore();
  
  applyFiltersToCanvas();
}

function applyFiltersToCanvas() {
  const chkShadow = document.getElementById('chk-shadow').checked;
  const chkContrast = document.getElementById('chk-contrast').checked;
  
  if (!chkShadow && !chkContrast) return;
  
  const w = canvas.width;
  const h = canvas.height;
  let imgData = ctx.getImageData(0, 0, w, h);
  let pixels = imgData.data;
  
  if (chkShadow) {
    for (let i = 0; i < pixels.length; i += 4) {
      let r = pixels[i];
      let g = pixels[i+1];
      let b = pixels[i+2];
      let intensity = 0.299 * r + 0.587 * g + 0.114 * b;
      
      if (intensity < 180) {
        let factor = 1.3 - (intensity / 600);
        pixels[i] = Math.min(r * factor, 255);
        pixels[i+1] = Math.min(g * factor, 255);
        pixels[i+2] = Math.min(b * factor, 255);
      }
      
      if (r > 240 && g > 240 && b > 240) {
        pixels[i] = Math.min(r * 0.95, 255);
        pixels[i+1] = Math.min(g * 0.94, 255);
        pixels[i+2] = Math.min(b * 0.93, 255);
      }
    }
  }
  
  if (chkContrast) {
    const isDarkBg = (currentBoardType === 'blackboard');
    for (let i = 0; i < pixels.length; i += 4) {
      let r = pixels[i];
      let g = pixels[i+1];
      let b = pixels[i+2];
      
      if (isDarkBg) {
        let brightness = (r + g + b) / 3;
        if (brightness < 60) {
          pixels[i] = Math.max(r * 0.4, 0);
          pixels[i+1] = Math.max(g * 0.4, 0);
          pixels[i+2] = Math.max(b * 0.4, 0);
        } else {
          pixels[i] = Math.min(r * 1.3, 255);
          pixels[i+1] = Math.min(g * 1.3, 255);
          pixels[i+2] = Math.min(b * 1.3, 255);
        }
      } else {
        let brightness = (r + g + b) / 3;
        if (brightness < 120) {
          pixels[i] = Math.max(r * 0.5, 0);
          pixels[i+1] = Math.max(g * 0.5, 0);
          pixels[i+2] = Math.max(b * 0.5, 0);
        } else if (brightness > 160) {
          pixels[i] = 252;
          pixels[i+1] = 252;
          pixels[i+2] = 254;
        }
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
}

function triggerImageRefresh() {
  drawSimulatedBoard();
}

function resetCanvasImage() {
  document.getElementById('chk-shadow').checked = false;
  document.getElementById('chk-contrast').checked = false;
  drawSimulatedBoard();
}

function triggerCapture() {
  const promptEl = document.querySelector('.stabilization-prompt');
  const checkText = document.getElementById('stabilize-text');
  
  promptEl.style.borderColor = 'var(--success)';
  checkText.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success);"></i> Board stabilized! Capturing...';
  
  setTimeout(() => {
    const saveDialog = document.getElementById('save-dialog');
    saveDialog.classList.add('active');
    
    setTimeout(() => {
      promptEl.style.borderColor = 'var(--border)';
      checkText.innerHTML = `Auto-detecting ${currentBoardType} boundaries...`;
    }, 1500);

    const select = document.getElementById('scan-folder-select');
    select.innerHTML = '<option value="">None (Root Workspace)</option>';
    
    const visibleFolders = dbData.folders.filter(f => f.ownerId === selectedSandboxUserId);

    visibleFolders.forEach(f => {
      select.innerHTML += `<option value="${f.id}">${f.name}</option>';
    });

    const input = document.getElementById('scan-file-name');
    const titleCap = currentBoardType.charAt(0).toUpperCase() + currentBoardType.slice(1);
    input.value = `${titleCap} Scan - ${new Date().toLocaleDateString()}`;
  }, 1000);
}

function closeSaveDialog() {
  document.getElementById('save-dialog').classList.remove('active');
}

async function saveCapturedScan() {
  const name = document.getElementById('scan-file-name').value.trim();
  const folderId = document.getElementById('scan-folder-select').value || null;
  
  if (!name) return alert("Please specify scan name");

  const actor = currentRole === 'BASIC' ? 'basic_john' : (currentRole === 'ADMIN' ? 'admin_clark' : 'god_system');
  const sizeKb = Math.floor(Math.random() * 2000) + 800;
  const size = `${(sizeKb/1000).toFixed(1)} MB`;

  try {
    const res = await fetch('/api/sim/scans/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        folderId,
        size,
        type: currentBoardType,
        actor
      })
    });

    if (res.ok) {
      const savedScan = await res.json();
      const dbScan = dbData.scans.find(s => s.id === savedScan.id);
      if (dbScan) dbScan.ownerId = selectedSandboxUserId;
    }

    closeSaveDialog();
    refreshData();
    switchPhoneTab('folders');
  } catch (err) {
    console.error("Error saving scan:", err);
  }
}

function navigateFolder(id) {
  currentFolderId = id;
  updatePhoneFolders();
}

function triggerPhoneSearch() {
  phoneSearchQuery = document.getElementById('phone-search-input').value.trim().toLowerCase();
  if (activeFileSystemTab === 0) {
    updatePhoneFolders();
  } else {
    renderDeviceStorageExplorer();
  }
}

function switchSandboxUserDemo() {
  selectedSandboxUserId = document.getElementById('phone-sandbox-select').value;
  currentFolderId = null; // reset to root
  updatePhoneFolders();
}

// Toggle subtabs (0: Sandbox, 1: Device Storage)
function switchFileSystemTabDemo(tabIndex) {
  activeFileSystemTab = tabIndex;
  
  const subtabSandbox = document.getElementById('subtab-sandbox');
  const subtabDevice = document.getElementById('subtab-device');
  const sandboxView = document.getElementById('phone-sandbox-explorer-view');
  const deviceView = document.getElementById('phone-device-explorer-view');
  const breadcrumbs = document.getElementById('folder-breadcrumbs');
  const devicePathBar = document.getElementById('phone-device-path-bar');
  
  const filesTitle = document.getElementById('phone-files-title');
  const createFolderBtn = document.getElementById('phone-create-folder-btn');
  const sandboxContainer = document.getElementById('phone-sandbox-container');

  if (tabIndex === 0) {
    // Sandbox Tab Active
    subtabSandbox.classList.add('active');
    subtabSandbox.style.borderBottomColor = 'var(--primary)';
    subtabDevice.classList.remove('active');
    subtabDevice.style.borderBottomColor = 'transparent';
    
    sandboxView.style.display = 'block';
    deviceView.style.display = 'none';
    breadcrumbs.style.display = 'flex';
    devicePathBar.style.display = 'none';

    filesTitle.textContent = "App Sandbox Explorer";
    createFolderBtn.style.display = 'flex';
    if (currentRole !== 'BASIC') sandboxContainer.style.display = 'block';
    
    updatePhoneFolders();
  } else {
    // Device Storage Active
    subtabDevice.classList.add('active');
    subtabDevice.style.borderBottomColor = 'var(--primary)';
    subtabSandbox.classList.remove('active');
    subtabSandbox.style.borderBottomColor = 'transparent';
    
    sandboxView.style.display = 'none';
    deviceView.style.display = 'block';
    breadcrumbs.style.display = 'none';
    devicePathBar.style.display = 'flex';

    filesTitle.textContent = "Android Files (A to Z)";
    createFolderBtn.style.display = 'none';
    sandboxContainer.style.display = 'none'; // hide sandbox dropdown in device lister
    
    renderDeviceStorageExplorer();
  }
}

// Render local Android device explorer alphabetically (A to Z)
function renderDeviceStorageExplorer() {
  const container = document.getElementById('device-explorer-list-items');
  const pathText = document.getElementById('phone-device-path');
  
  pathText.textContent = deviceExplorerCurrentPath;
  container.innerHTML = '';

  let filesList = [];

  // Generate simulated directories/files alphabetically from A to Z
  if (deviceExplorerCurrentPath === '/storage/emulated/0') {
    filesList = [
      { name: 'Alarms', isDir: true },
      { name: 'Android', isDir: true },
      { name: 'DCIM', isDir: true },
      { name: 'Documents', isDir: true },
      { name: 'Downloads', isDir: true },
      { name: 'Movies', isDir: true },
      { name: 'Music', isDir: true },
      { name: 'Pictures', isDir: true },
      { name: 'Podcasts', isDir: true },
      { name: 'Ringtones', isDir: true },
    ];
  } else if (deviceExplorerCurrentPath.endsWith('DCIM')) {
    filesList = [
      { name: 'Camera', isDir: true },
      { name: 'Screenshots', isDir: true },
    ];
  } else if (deviceExplorerCurrentPath.endsWith('Camera')) {
    filesList = [
      { name: 'IMG_20260728_101230.jpg', isDir: false, size: '2.4 MB' },
      { name: 'IMG_20260728_154522.jpg', isDir: false, size: '1.8 MB' },
    ];
  } else if (deviceExplorerCurrentPath.endsWith('Downloads')) {
    filesList = [
      { name: 'Classroom_Notes_Math.pdf', isDir: false, size: '4.8 MB' },
      { name: 'Physics_Lab_Syllabus.docx', isDir: false, size: '1.1 MB' },
      { name: 'Whiteboard_Capture_Backup.zip', isDir: false, size: '22.4 MB' },
    ];
  } else {
    // Empty default directory
    filesList = [];
  }

  // Sort alphabetically from A to Z (Folders first, then files)
  filesList.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  // Apply search query filter
  if (phoneSearchQuery) {
    filesList = filesList.filter(item => item.name.toLowerCase().includes(phoneSearchQuery));
  }

  filesList.forEach(item => {
    const icon = item.isDir ? 'fa-folder' : 'fa-file-invoice';
    const color = item.isDir ? 'color: var(--warning);' : 'color: var(--text-muted);';
    
    if (item.isDir) {
      container.innerHTML += `
        <div class="scan-card" onclick="navigateDeviceFolderDemo('${item.name}')" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid ${icon}" style="font-size:18px; ${color}"></i>
            <div class="scan-meta">
              <span class="scan-title" style="font-size:12px; font-weight:600;">${item.name}</span>
              <span class="scan-subtext" style="font-size:9px; color:var(--text-muted);">Folder Directory</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right" style="font-size:10px; color:var(--text-muted);"></i>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="scan-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <i class="fa-solid ${icon}" style="font-size:18px; ${color}"></i>
            <div class="scan-meta">
              <span class="scan-title" style="font-size:12px; font-weight:600;">${item.name}</span>
              <span class="scan-subtext" style="font-size:9px; color:var(--text-muted);">Size: ${item.size}</span>
            </div>
          </div>
          <button class="scan-action-mini" title="Import to App" onclick="importFileToScannerDemo('${item.name}', '${item.size}')" style="background:none; border:none; color:var(--primary); cursor:pointer;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </button>
        </div>
      `;
    }
  });

  if (filesList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px 10px; color:var(--text-muted); font-size:12px;">Directory is empty</div>`;
  }
}

function navigateDeviceFolderDemo(folderName) {
  deviceExplorerCurrentPath += '/' + folderName;
  const searchInput = document.getElementById('phone-search-input');
  if (searchInput) searchInput.value = '';
  phoneSearchQuery = '';
  renderDeviceStorageExplorer();
}

function navigateDeviceParentDemo() {
  if (deviceExplorerCurrentPath === '/storage/emulated/0') return;
  const parts = deviceExplorerCurrentPath.split('/');
  parts.pop();
  deviceExplorerCurrentPath = parts.join('/');
  
  const searchInput = document.getElementById('phone-search-input');
  if (searchInput) searchInput.value = '';
  phoneSearchQuery = '';
  renderDeviceStorageExplorer();
}

// Import external file from phone storage into app database
async function importFileToScannerDemo(filename, size) {
  const actor = currentRole === 'BASIC' ? 'basic_john' : (currentRole === 'ADMIN' ? 'admin_clark' : 'god_system');
  
  // Clean name
  const name = filename.substring(0, filename.lastIndexOf('.')) || filename;

  try {
    const res = await fetch('/api/sim/scans/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name + ' (Imported)',
        folderId: null, // imports to root
        size,
        type: 'document',
        actor
      })
    });

    if (res.ok) {
      const savedScan = await res.json();
      const dbScan = dbData.scans.find(s => s.id === savedScan.id);
      if (dbScan) dbScan.ownerId = selectedSandboxUserId;
      
      alert(`Imported "${filename}" into Classroom Board Scanner sandbox!`);
      refreshData();
    }
  } catch (err) {
    console.error("Import error:", err);
  }
}

function updatePhoneFolders() {
  if (!dbData.folders) return;

  const folderGrid = document.getElementById('folder-grid-items');
  const scanList = document.getElementById('scan-list-items');
  const breadcrumbs = document.getElementById('folder-breadcrumbs');

  folderGrid.innerHTML = '';
  scanList.innerHTML = '';

  if (currentFolderId === null) {
    breadcrumbs.innerHTML = '<span style="color:var(--text-muted); font-size:12px; font-weight:bold;">Root Workspace</span>';
  } else {
    const curFold = dbData.folders.find(f => f.id === currentFolderId);
    breadcrumbs.innerHTML = `<span class="breadcrumb-link" onclick="navigateFolder(null)">Root</span> <i class="fa-solid fa-chevron-right" style="font-size:10px; margin:0 4px; color:var(--text-muted);"></i> <span style="font-size:12px; font-weight:bold; color:white;">${curFold ? curFold.name : 'Subfolder'}</span>`;
  }

  let foldersToRender = dbData.folders.filter(f => 
    f.parentId === currentFolderId && f.ownerId === selectedSandboxUserId
  );

  let scansToRender = dbData.scans.filter(s => 
    s.folderId === currentFolderId && s.ownerId === selectedSandboxUserId
  );

  if (phoneSearchQuery) {
    foldersToRender = foldersToRender.filter(f => f.name.toLowerCase().includes(phoneSearchQuery));
    scansToRender = scansToRender.filter(s => s.name.toLowerCase().includes(phoneSearchQuery));
  }

  foldersToRender.forEach(f => {
    const ownerName = dbData.users.find(u => u.id === f.ownerId)?.username || 'unknown';
    folderGrid.innerHTML += `
      <div class="folder-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div onclick="navigateFolder('${f.id}')" style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer;">
          <i class="fa-solid fa-folder" style="font-size:22px; color:var(--primary);"></i>
          <div class="folder-info">
            <span class="folder-name" style="font-size:13px; font-weight:600;">${f.name}</span>
            <span class="folder-owner" style="font-size:9px; color:var(--text-muted);">Subject Folder</span>
          </div>
        </div>
        <button class="scan-action-mini" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" onclick="openPhoneActionSheet('${f.id}', '${f.name}', true)">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
      </div>
    `;
  });

  scansToRender.forEach(s => {
    scanList.innerHTML += `
      <div class="scan-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
        <div class="scan-left" style="display:flex; align-items:center; gap:10px; flex:1;">
          <i class="fa-regular fa-image" style="font-size:18px; color:var(--accent);"></i>
          <div class="scan-meta">
            <span class="scan-title" style="font-size:12px; font-weight:600;">${s.name}</span>
            <span class="scan-subtext" style="font-size:9px; color:var(--text-muted);">${s.size} • ${s.type.toUpperCase()}</span>
          </div>
        </div>
        <div class="scan-right" style="display:flex; gap:2px;">
          <button class="scan-action-mini" title="PDF Compile" onclick="pdfCompileDemo('${s.name}')">
            <i class="fa-solid fa-file-pdf" style="color:var(--danger); font-size:11px;"></i>
          </button>
          <button class="scan-action-mini" title="Actions" onclick="openPhoneActionSheet('${s.id}', '${s.name}', false)">
            <i class="fa-solid fa-ellipsis-vertical" style="font-size:11px;"></i>
          </button>
        </div>
      </div>
    `;
  });

  if (foldersToRender.length === 0 && scansToRender.length === 0) {
    folderGrid.parentElement.innerHTML += `<div id="empty-folder-indicator" style="text-align:center; padding:40px 10px; color:var(--text-muted); font-size:12px;">No matching folders or scans found.</div>`;
  } else {
    const emptyInd = document.getElementById('empty-folder-indicator');
    if (emptyInd) emptyInd.remove();
  }
}

function openPhoneActionSheet(id, name, isFolder) {
  activeActionItemId = id;
  activeActionItemName = name;
  activeActionItemIsFolder = isFolder;

  document.getElementById('action-sheet-title').textContent = `Manage: ${name}`;
  document.getElementById('phone-action-sheet').classList.add('active');
}

function closePhoneActionSheet() {
  document.getElementById('phone-action-sheet').classList.remove('active');
}

async function triggerRenameDemoPrompt() {
  const newName = prompt(`Rename this ${activeActionItemIsFolder ? 'folder' : 'scan'} to:`, activeActionItemName);
  if (!newName || newName.trim() === '') return closePhoneActionSheet();

  const actor = currentRole === 'BASIC' ? 'basic_john' : (currentRole === 'ADMIN' ? 'admin_clark' : 'god_system');

  if (activeActionItemIsFolder) {
    const folder = dbData.folders.find(f => f.id === activeActionItemId);
    if (folder) folder.name = newName;
  } else {
    const scan = dbData.scans.find(s => s.id === activeActionItemId);
    if (scan) scan.name = newName;
  }

  closePhoneActionSheet();

  await fetch('/api/sim/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: actor,
      action: "RENAME_RESOURCE",
      details: `Renamed ${activeActionItemIsFolder ? 'Folder' : 'Scan'} from "${activeActionItemName}" to "${newName}"`
    })
  });

  refreshData();
}

async function triggerMoveDemoPrompt() {
  const candidateFolders = dbData.folders.filter(f => f.id !== activeActionItemId && f.ownerId === selectedSandboxUserId);
  let folderListStr = "Root Workspace (Input 'ROOT')\n";
  candidateFolders.forEach(f => {
    folderListStr += `- ${f.name}\n`;
  });

  const targetName = prompt(`Move "${activeActionItemName}" into which subject folder?\n\nAvailable Folders:\n${folderListStr}`, "ROOT");
  if (!targetName) return closePhoneActionSheet();

  let targetFolderId = null;
  if (targetName.toUpperCase() !== 'ROOT') {
    const match = candidateFolders.find(f => f.name.toLowerCase() === targetName.trim().toLowerCase());
    if (!match) {
      alert("Subject folder not found. Action canceled.");
      return closePhoneActionSheet();
    }
    targetFolderId = match.id;
  }

  const actor = currentRole === 'BASIC' ? 'basic_john' : (currentRole === 'ADMIN' ? 'admin_clark' : 'god_system');

  if (activeActionItemIsFolder) {
    const folder = dbData.folders.find(f => f.id === activeActionItemId);
    if (folder) folder.parentId = targetFolderId;
  } else {
    const scan = dbData.scans.find(s => s.id === activeActionItemId);
    if (scan) scan.folderId = targetFolderId;
  }

  closePhoneActionSheet();

  await fetch('/api/sim/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: actor,
      action: "MOVE_RESOURCE",
      details: `Moved ${activeActionItemIsFolder ? 'Folder' : 'Scan'} "${activeActionItemName}" into "${targetName}"`
    })
  });

  refreshData();
}

async function triggerDeleteDemo() {
  const confirmDel = confirm(`Are you sure you want to delete "${activeActionItemName}"?`);
  if (!confirmDel) return closePhoneActionSheet();

  const actor = currentRole === 'BASIC' ? 'basic_john' : (currentRole === 'ADMIN' ? 'admin_clark' : 'god_system');

  if (activeActionItemIsFolder) {
    const idx = dbData.folders.findIndex(f => f.id === activeActionItemId);
    if (idx !== -1) {
      dbData.folders.splice(idx, 1);
      dbData.scans = dbData.scans.filter(s => s.folderId !== activeActionItemId);

      await fetch('/api/sim/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: actor,
          action: "DELETE_FOLDER",
          details: `Deleted folder "${activeActionItemName}" and cascaded its contents`
        })
      });
    }
  } else {
    await fetch('/api/sim/scans/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId: activeActionItemId, actor })
    });
  }

  closePhoneActionSheet();
  refreshData();
}

function switchRole(role) {
  currentRole = role;
  
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('active');

  const lockoutScreen = document.getElementById('lockout-screen');
  const godLockoutShield = document.getElementById('god-lockout-shield');
  const activeBadge = document.getElementById('active-console-badge');
  const adminTabPhone = document.getElementById('nav-profile');
  
  const phoneSandboxContainer = document.getElementById('phone-sandbox-container');
  const phoneSandboxSelect = document.getElementById('phone-sandbox-select');

  if (role === 'BASIC') {
    lockoutScreen.style.display = 'flex';
    adminTabPhone.style.display = 'none';
    phoneSandboxContainer.style.display = 'none';
    
    selectedSandboxUserId = 'u1';
    phoneSandboxSelect.value = 'u1';

    if (currentPhoneTab === 'profile') {
      switchPhoneTab('scanner');
    }
  } else {
    lockoutScreen.style.display = 'none';
    adminTabPhone.style.display = 'flex';
    
    // Only display sandbox select if on Sandbox subtab
    if (activeFileSystemTab === 0) {
      phoneSandboxContainer.style.display = 'block';
    }

    if (role === 'ADMIN') {
      activeBadge.textContent = 'L2 - ADMIN';
      activeBadge.className = 'console-badge admin';
      godLockoutShield.style.display = 'flex';
      
      selectedSandboxUserId = 'u1';
      phoneSandboxSelect.value = 'u1';
      phoneSandboxSelect.innerHTML = `
        <option value="u1">basic_john (Student)</option>
        <option value="u2">basic_emma (Student)</option>
        <option value="u3">admin_clark (Admin)</option>
      `;

      if (activeConsoleTab === 'logs') {
        switchConsoleTab('users');
      }
    } else { // GOD
      activeBadge.textContent = 'L3 - GOD';
      activeBadge.className = 'console-badge god';
      godLockoutShield.style.display = 'none';

      selectedSandboxUserId = 'u1';
      phoneSandboxSelect.value = 'u1';
      phoneSandboxSelect.innerHTML = `
        <option value="u1">basic_john (Student)</option>
        <option value="u2">basic_emma (Student)</option>
        <option value="u3">admin_clark (Admin)</option>
        <option value="u4">god_system (God)</option>
      `;
    }
  }

  const profileName = document.getElementById('profile-name');
  const profileRole = document.getElementById('profile-role');
  if (role === 'BASIC') {
    profileName.textContent = 'basic_john';
    profileRole.textContent = 'BASIC USER';
  } else if (role === 'ADMIN') {
    profileName.textContent = 'admin_clark';
    profileRole.textContent = 'ADMINISTRATOR';
  } else {
    profileName.textContent = 'god_system';
    profileRole.textContent = 'GOD ACCOUNT';
  }

  currentFolderId = null;
  
  const searchInput = document.getElementById('phone-search-input');
  if (searchInput) {
    searchInput.value = '';
    phoneSearchQuery = '';
  }

  // Force reset back to Sandbox subtab on role swap
  switchFileSystemTabDemo(0);
}

function switchPhoneTab(tab) {
  currentPhoneTab = tab;
  document.querySelectorAll('.phone-nav-item').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.phone-view').forEach(view => view.classList.remove('active'));

  if (tab === 'scanner') {
    document.getElementById('nav-scan').classList.add('active');
    document.getElementById('phone-scanner-view').classList.add('active');
    initCanvas();
  } else if (tab === 'folders') {
    document.getElementById('nav-folders').classList.add('active');
    document.getElementById('phone-folders-view').classList.add('active');
    switchFileSystemTabDemo(0); // reset to sandbox
  } else {
    document.getElementById('nav-profile').classList.add('active');
    document.getElementById('phone-profile-view').classList.add('active');
  }
}

function switchConsoleTab(tab) {
  activeConsoleTab = tab;
  document.querySelectorAll('.console-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelectorAll('.console-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
}

function updateConsoleDashboard() {
  if (!dbData.users) return;

  document.getElementById('stat-scans').textContent = `${dbData.scans.length} Scans`;
  document.getElementById('stat-logs').textContent = `${dbData.auditLogs.length} Records`;
  
  let totalBytes = dbData.scans.reduce((acc, s) => {
    let sizeMb = parseFloat(s.size);
    return acc + (sizeMb * 1024 * 1024);
  }, 0);
  document.getElementById('stat-space').textContent = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

  const userTable = document.getElementById('user-table-body');
  userTable.innerHTML = '';

  const usersToDisplay = currentRole === 'ADMIN'
      ? dbData.users.filter(u => u.role === 'BASIC')
      : dbData.users;

  usersToDisplay.forEach(u => {
    const isSelf = (currentRole === 'ADMIN' && u.username === 'admin_clark') || (currentRole === 'GOD' && u.username === 'god_system');
    const actionsDisabled = isSelf || (currentRole === 'ADMIN' && u.role === 'ADMIN') || u.role === 'GOD';

    userTable.innerHTML += `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.email}</td>
        <td><span class="console-badge ${u.role.toLowerCase()}">${u.role}</span></td>
        <td>
          <span class="badge-status ${u.isLocked ? 'locked' : 'active'}">
            ${u.isLocked ? 'Locked' : 'Active'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="console-btn" ${actionsDisabled ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} onclick="resetUserPasswordSim('${u.id}')">
            Reset Password
          </button>
          <button class="console-btn ${u.isLocked ? '' : 'danger'}" ${actionsDisabled ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} onclick="toggleUserLockSim('${u.id}', ${u.isLocked})">
            ${u.isLocked ? 'Unlock' : 'Lock Account'}
          </button>
        </td>
      </tr>
    `;
  });

  const deviceGrid = document.getElementById('device-grid-items');
  deviceGrid.innerHTML = '';

  const devicesToDisplay = currentRole === 'ADMIN'
      ? dbData.devices.filter(d => dbData.users.find(u => u.id === d.userId)?.role === 'BASIC')
      : dbData.devices;

  devicesToDisplay.forEach(d => {
    deviceGrid.innerHTML += `
      <div class="device-card">
        <div class="device-card-header">
          <span class="device-title">${d.device}</span>
          <span class="device-owner-label">${d.username}</span>
        </div>
        <div class="device-metric">
          <span class="device-metric-label">Model</span>
          <span>${d.model}</span>
        </div>
        <div class="device-metric">
          <span class="device-metric-label">Android OS</span>
          <span>${d.os}</span>
        </div>
        <div class="device-metric">
          <span class="device-metric-label">App Version</span>
          <span>${d.app}</span>
        </div>
        <div class="device-metric">
          <span class="device-metric-label">Storage Usage</span>
          <span>${d.storage}</span>
        </div>
        <div class="device-metric">
          <span class="device-metric-label">Sync Status</span>
          <span style="color: ${d.sync === 'Synced' ? 'var(--success)' : 'var(--warning)'}; font-weight:600;">
            ${d.sync}
          </span>
        </div>
      </div>
    `;
  });

  const logsViewport = document.getElementById('audit-logs-viewport');
  logsViewport.innerHTML = '';

  dbData.auditLogs.forEach(l => {
    logsViewport.innerHTML += `
      <div class="log-entry ${l.action}">
        <span class="log-time">[${l.time}]</span>
        <span class="log-user">${l.user}</span>: 
        <span class="log-action">${l.action}</span> - 
        <span class="log-details">${l.details}</span>
      </div>
    `;
  });
}

async function toggleUserLockSim(userId, isLocked) {
  const actor = currentRole === 'ADMIN' ? 'admin_clark' : 'god_system';
  try {
    await fetch('/api/sim/users/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        isLocked: !isLocked,
        actor
      })
    });
    refreshData();
  } catch (err) {
    console.error("Lock error:", err);
  }
}

async function resetUserPasswordSim(userId) {
  const actor = currentRole === 'ADMIN' ? 'admin_clark' : 'god_system';
  const confirmReset = confirm("Are you sure you want to reset password parameters for this user?");
  if (!confirmReset) return;

  try {
    await fetch('/api/sim/users/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, actor })
    });
    alert("User password updated to default credentials.");
    refreshData();
  } catch (err) {
    console.error("Reset error:", err);
  }
}

function setCaptureMode(mode) {
  captureMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
}
