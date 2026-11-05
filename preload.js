const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('makerfoxDesktop',{
 platform:process.platform,
 getVersion:()=>ipcRenderer.invoke('makerfox:get-version'),
 storageDiagnostic:(entry)=>ipcRenderer.invoke('makerfox:storage-diagnostic',entry),
 openStorageLog:()=>ipcRenderer.invoke('makerfox:open-storage-log'),
 openModel:(buffer,fileName)=>ipcRenderer.invoke('makerfox:open-model',{buffer,fileName}),
 checkUpdates:()=>ipcRenderer.invoke('makerfox:check-updates'),
 installUpdate:()=>ipcRenderer.invoke('makerfox:install-update'),
 onUpdateStatus:(callback)=>ipcRenderer.on('makerfox:update-status',(_event,data)=>callback(data))
});
