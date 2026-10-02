/* HomePoint LED: envuelve led.html en una ventana de Electron.
   - Carga led.html empaquetado (o ../led.html al correr con `npm start`)
   - Expone a la pagina la lista de monitores (preload.js) y mueve la
     ventana al elegido antes de pasar a pantalla completa
   - Recuerda la ultima pantalla de contenido (?s=) entre reinicios
   - Arranca con Windows y no deja que el monitor se apague */
const { app, BrowserWindow, Menu, ipcMain, screen, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { return {}; }
}

function writeSettings(patch) {
  const next = Object.assign(readSettings(), patch);
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2)); } catch (e) { /* silenciar */ }
}

function ledHtmlPath() {
  const packaged = path.join(__dirname, 'led.html');
  return fs.existsSync(packaged) ? packaged : path.join(__dirname, '..', 'led.html');
}

// Una sola instancia: si se abre de nuevo, se enfoca la que ya corre
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function createWindow() {
  const settings = readSettings();

  win = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#000000',
    title: 'HomePoint LED',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  // Parametros de la linea de comandos (--s=vidriera --test --debug) tienen
  // prioridad sobre la ultima pantalla recordada
  const query = {};
  const argS = process.argv.find(a => a.startsWith('--s='));
  query.s = argS ? argS.slice(4) : (settings.screenId || 'default');
  if (process.argv.includes('--test')) query.test = '1';
  if (process.argv.includes('--debug')) query.debug = '1';

  win.loadFile(ledHtmlPath(), { query });

  // El menu de pantallas de led.html navega a ?s=otra: guardarla
  win.webContents.on('did-navigate', (e, url) => {
    try {
      const s = new URL(url).searchParams.get('s');
      if (s) writeSettings({ screenId: s });
    } catch (err) { /* silenciar */ }
  });

  // Atajos: F5 recarga, Ctrl+Shift+I herramientas, Ctrl+Q sale
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
    else if (input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault(); }
    else if (input.control && input.key.toLowerCase() === 'q') { app.quit(); e.preventDefault(); }
  });

  // Si la pagina se cuelga o el renderer muere, recargar
  win.webContents.on('render-process-gone', () => win.webContents.reload());
  win.webContents.on('unresponsive', () => win.webContents.reload());
}

/* ==========================================================
   MONITORES: la pagina pide la lista y elige uno
   ========================================================== */
ipcMain.handle('led:get-displays', (e) => {
  const sender = BrowserWindow.fromWebContents(e.sender);
  const current = sender ? screen.getDisplayMatching(sender.getBounds()) : null;
  const primary = screen.getPrimaryDisplay();
  // Mismo formato que ScreenDetailed de la Window Management API, para que
  // led.html los dibuje igual. bounds esta en DIP, como screen.width del navegador.
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    label: d.label || '',
    left: d.bounds.x,
    top: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    devicePixelRatio: d.scaleFactor,
    isPrimary: d.id === primary.id,
    isCurrent: !!current && d.id === current.id
  }));
});

ipcMain.handle('led:move-to-display', (e, id) => {
  const sender = BrowserWindow.fromWebContents(e.sender);
  const target = screen.getAllDisplays().find(d => d.id === id);
  if (!sender || !target) return false;
  if (sender.isFullScreen()) sender.setFullScreen(false);
  const wa = target.workArea;
  sender.setBounds({
    x: wa.x + 40,
    y: wa.y + 40,
    width: Math.min(900, wa.width - 80),
    height: Math.min(700, wa.height - 80)
  });
  return true;
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Abrir sola al iniciar sesion en Windows (solo en la app instalada)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Cartel siempre encendido: sin suspension ni apagado de pantalla
  powerSaveBlocker.start('prevent-display-sleep');

  createWindow();
});

app.on('window-all-closed', () => app.quit());
