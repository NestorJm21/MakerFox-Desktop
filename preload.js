const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('makerfoxDesktop',{
 platform:process.platform,
 version:'2.0.0',
 openModel:(buffer,fileName)=>ipcRenderer.invoke('makerfox:open-model',{buffer,fileName}),
 enviaSaveToken:(token)=>ipcRenderer.invoke('makerfox:envia-save-token',token),
 enviaTokenStatus:()=>ipcRenderer.invoke('makerfox:envia-token-status'),
 enviaClearToken:()=>ipcRenderer.invoke('makerfox:envia-clear-token'),
 enviaGeocode:(postalCode)=>ipcRenderer.invoke('makerfox:envia-geocode',postalCode),
 enviaRate:(payload)=>ipcRenderer.invoke('makerfox:envia-rate',payload),
 checkUpdates:()=>ipcRenderer.invoke('makerfox:check-updates'),
 installUpdate:()=>ipcRenderer.invoke('makerfox:install-update'),
 onUpdateStatus:(callback)=>ipcRenderer.on('makerfox:update-status',(_event,data)=>callback(data))
});
