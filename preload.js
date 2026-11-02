const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('makerfoxDesktop',{
 platform:process.platform,
 version:'1.2.0',
 openModel:(buffer,fileName)=>ipcRenderer.invoke('makerfox:open-model',{buffer,fileName}),
 checkUpdates:()=>ipcRenderer.invoke('makerfox:check-updates'),
 onUpdateStatus:(callback)=>ipcRenderer.on('makerfox:update-status',(_event,data)=>callback(data))
});
