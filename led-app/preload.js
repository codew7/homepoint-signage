// Puente minimo entre led.html y Electron: solo lo necesario para elegir monitor.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledApp', {
  getDisplays: () => ipcRenderer.invoke('led:get-displays'),
  moveToDisplay: (id) => ipcRenderer.invoke('led:move-to-display', id)
});
