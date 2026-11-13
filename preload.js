const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('makerfoxDesktop',{
 platform:process.platform,
 version:'2.0.0',
 openModel:(buffer,fileName)=>ipcRenderer.invoke('makerfox:open-model',{buffer,fileName}),
 drenvioSaveToken:(token)=>ipcRenderer.invoke('makerfox:drenvio-save-token',token),
 drenvioTokenStatus:()=>ipcRenderer.invoke('makerfox:drenvio-token-status'),
 drenvioClearToken:()=>ipcRenderer.invoke('makerfox:drenvio-clear-token'),
 drenvioRate:(payload)=>ipcRenderer.invoke('makerfox:drenvio-rate',payload),
 validatePostal:(postal)=>ipcRenderer.invoke('makerfox:validate-postal',postal),
 checkUpdates:()=>ipcRenderer.invoke('makerfox:check-updates'),
 installUpdate:()=>ipcRenderer.invoke('makerfox:install-update'),
 onUpdateStatus:(callback)=>ipcRenderer.on('makerfox:update-status',(_event,data)=>callback(data))
});
