// Pont IPC MRA-Finder v2 — expose finder étendu (suggest, export, health, history)

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  finder: {
    stats: () => ipcRenderer.invoke('finder:stats'),
    search: (params) => ipcRenderer.invoke('finder:search', params),
    suggest: (params) => ipcRenderer.invoke('finder:suggest', params),
    brands: (params) => ipcRenderer.invoke('finder:brands', params),
    brand: (params) => ipcRenderer.invoke('finder:brand', params),
    devices: (params) => ipcRenderer.invoke('finder:devices', params),
    device: (id) => ipcRenderer.invoke('finder:device', id),
    part: (id) => ipcRenderer.invoke('finder:part', id),
    ic: (id) => ipcRenderer.invoke('finder:ic', id),
    importParts: (params) => ipcRenderer.invoke('finder:import', params),
    // V2 — récupération & diagnostic
    exportData: (params) => ipcRenderer.invoke('finder:export', params),
    importHistory: (params) => ipcRenderer.invoke('finder:importHistory', params),
    healthCheck: () => ipcRenderer.invoke('finder:health'),
    recentParts: (params) => ipcRenderer.invoke('finder:recentParts', params),
  },
})
