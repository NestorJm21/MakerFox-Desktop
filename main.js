const { app, BrowserWindow, protocol, net, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme:'makerfox', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true} }]);
let mainWindow;
function sendUpdateStatus(status, message, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('makerfox:update-status', { status, message, ...extra });
}
function createWindow(){
 mainWindow = new BrowserWindow({width:1450,height:940,minWidth:900,minHeight:650,backgroundColor:'#101114',title:'MakerFox 1.2.0',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow.loadURL('makerfox://app/index.html');
 mainWindow.on('closed',()=>{mainWindow=null;});
}
ipcMain.handle('makerfox:open-model', async (_event,payload)=>{
 try{
  if(!payload||!payload.buffer||typeof payload.fileName!=='string')return {ok:false,error:'No se recibió un archivo válido.'};
  const extension=path.extname(payload.fileName).toLowerCase(),allowed=new Set(['.3mf','.stl','.obj','.step','.stp']);
  if(!allowed.has(extension))return {ok:false,error:'Formato no admitido.'};
  const safeName=path.basename(payload.fileName).replace(/[<>:"/\\|?*]/g,'_');
  const dir=path.join(app.getPath('temp'),'MakerFox-opened-models');await fs.promises.mkdir(dir,{recursive:true});
  const dest=path.join(dir,`${Date.now()}-${safeName}`);await fs.promises.writeFile(dest,Buffer.from(payload.buffer));
  const error=await shell.openPath(dest);if(error)return {ok:false,error};
  return {ok:true};
 }catch(e){return {ok:false,error:e.message||'No se pudo abrir el archivo.'}}
});
ipcMain.handle('makerfox:check-updates', async ()=>{
 if (!app.isPackaged) return { ok:false, message:'La búsqueda de actualizaciones funciona en la versión instalada, no desde el modo de desarrollo.' };
 try { await autoUpdater.checkForUpdates(); return { ok:true, message:'Buscando actualizaciones...' }; }
 catch (e) { return { ok:false, message:e.message || 'No se pudo buscar actualizaciones.' }; }
});
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update',()=>sendUpdateStatus('checking','Buscando actualizaciones...'));
autoUpdater.on('update-available',info=>sendUpdateStatus('available',`Nueva versión ${info.version} encontrada. Se está descargando...`,{version:info.version}));
autoUpdater.on('update-not-available',()=>sendUpdateStatus('current','MakerFox está actualizado.'));
autoUpdater.on('download-progress',p=>sendUpdateStatus('downloading',`Descargando actualización: ${Math.round(p.percent)}%`,{percent:Math.round(p.percent)}));
autoUpdater.on('update-downloaded',info=>sendUpdateStatus('downloaded',`La versión ${info.version} está lista. Cierra y vuelve a abrir MakerFox para instalarla.`,{version:info.version}));
autoUpdater.on('error',e=>sendUpdateStatus('error',`Error al actualizar: ${e.message || 'error desconocido'}`));
app.whenReady().then(()=>{
 protocol.handle('makerfox',request=>{
  const url=new URL(request.url),requested=decodeURIComponent(url.pathname),target=path.join(__dirname,requested.replace(/^\/+/,'')),root=path.resolve(__dirname);
  if(!target.startsWith(root))return new Response('Forbidden',{status:403});
  return net.fetch(pathToFileURL(target).toString());
 });
 createWindow();
 if (app.isPackaged) setTimeout(()=>autoUpdater.checkForUpdates().catch(e=>sendUpdateStatus('error',e.message)),5000);
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
