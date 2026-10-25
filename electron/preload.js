// Pont IPC de la copie MRA-Finder.
//
// Ce fichier contient UNIQUEMENT le bloc `finder` de `MRA-ERP/electron/preload.js`
// (lignes 539 à 551), copié verbatim : mêmes canaux, mêmes signatures, mêmes
// noms de propriétés. Les 307 autres canaux de MRA-ERP n'existent pas ici.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // MRA FINDER — lecture seule. Aucun canal ici ne modifie la base.
  finder: {
    stats: () => ipcRenderer.invoke('finder:stats'),
    search: (params) => ipcRenderer.invoke('finder:search', params),
    brands: (params) => ipcRenderer.invoke('finder:brands', params),
    brand: (params) => ipcRenderer.invoke('finder:brand', params),
    devices: (params) => ipcRenderer.invoke('finder:devices', params),
    device: (id) => ipcRenderer.invoke('finder:device', id),
    part: (id) => ipcRenderer.invoke('finder:part', id),
    ic: (id) => ipcRenderer.invoke('finder:ic', id),
    // Seul canal Finder qui écrit : import de références (statuts déclarés).
    importParts: (params) => ipcRenderer.invoke('finder:import', params),
  },
})
