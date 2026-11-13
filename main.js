const { app, BrowserWindow, protocol, net, ipcMain, shell, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme:'makerfox', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true} }]);
let mainWindow;
let updateDownloaded = false;
function sendUpdateStatus(status, message, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('makerfox:update-status', { status, message, ...extra });
}

const enviaTokenPath = () => path.join(app.getPath('userData'), 'envia-token.enc');
async function readEnviaToken(){
  try{
    if(!safeStorage.isEncryptionAvailable()) throw new Error('El cifrado seguro de Windows no está disponible.');
    const encrypted=await fs.promises.readFile(enviaTokenPath());
    return safeStorage.decryptString(encrypted);
  }catch(e){ if(e.code==='ENOENT') return ''; throw e; }
}
ipcMain.handle('makerfox:envia-save-token', async (_event, token)=>{
  try{
    if(!safeStorage.isEncryptionAvailable()) return {ok:false,error:'El cifrado seguro de Windows no está disponible.'};
    if(typeof token!=='string'||token.trim().length<10) return {ok:false,error:'Introduce un token API válido.'};
    const encrypted=safeStorage.encryptString(token.trim());
    await fs.promises.writeFile(enviaTokenPath(),encrypted,{mode:0o600});
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||'No se pudo guardar el token.'};}
});
ipcMain.handle('makerfox:envia-token-status', async ()=>{
  try{return {ok:true,configured:!!(await readEnviaToken())};}
  catch(e){return {ok:false,error:e.message||'No se pudo leer la configuración.'};}
});
ipcMain.handle('makerfox:envia-clear-token', async ()=>{
  try{await fs.promises.rm(enviaTokenPath(),{force:true});return {ok:true};}
  catch(e){return {ok:false,error:e.message||'No se pudo eliminar el token.'};}
});
ipcMain.handle('makerfox:envia-geocode', async (_event, postalCode)=>{
  try{
    const cp=String(postalCode||'').replace(/\D/g,'');
    if(!/^\d{5}$/.test(cp)) return {ok:false,error:'Captura un código postal de 5 dígitos.'};
    const response=await fetch('https://geocodes.envia.com/zipcode/MX/'+cp);
    const data=await response.json();
    if(!response.ok||data.success===false) return {ok:false,error:data.message||'No se encontró el código postal.'};
    return {ok:true,data:data.data||data};
  }catch(e){return {ok:false,error:e.message||'No se pudo validar el código postal.'};}
});
ipcMain.handle('makerfox:envia-rate', async (_event, payload)=>{
  try{
    const token=await readEnviaToken();
    if(!token) return {ok:false,error:'Primero configura tu token de Envia en Ajustes.'};
    if(!payload||!payload.origin||!payload.destination||!Array.isArray(payload.packages)||!payload.packages.length) return {ok:false,error:'Faltan datos de origen, destino o paquete.'};
    const carriers=['estafeta','paquetexpress'];
    const results=await Promise.allSettled(carriers.map(async carrier=>{
      const response=await fetch('https://api.envia.com/ship/rate/',{
        method:'POST',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({origin:payload.origin,destination:payload.destination,packages:payload.packages,shipment:{type:1,carrier}})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error((data.message||data.error||('Error HTTP '+response.status))+' ('+carrier+')');
      return Array.isArray(data.data)?data.data:(Array.isArray(data)?data:[]);
    }));
    const rates=results.filter(x=>x.status==='fulfilled').flatMap(x=>x.value).map(rate=>({
      carrier:rate.carrier||rate.carrierName||'',
      service:rate.service||rate.serviceDescription||'Servicio',
      serviceDescription:rate.serviceDescription||rate.service||'',
      totalPrice:Number(rate.totalPrice??rate.total??rate.price??0),
      currency:rate.currency||'MXN',
      deliveryEstimate:rate.deliveryEstimate||rate.deliveryTime||'No especificado'
    })).filter(x=>Number.isFinite(x.totalPrice)&&x.totalPrice>=0);
    const errors=results.filter(x=>x.status==='rejected').map(x=>x.reason?.message||'Error de cotización');
    if(!rates.length&&errors.length) return {ok:false,error:errors.join(' · ')};
    return {ok:true,rates,errors};
  }catch(e){return {ok:false,error:e.message||'No se pudo consultar Envia.'};}
});

function createWindow(){
 mainWindow = new BrowserWindow({width:1450,height:940,minWidth:900,minHeight:650,backgroundColor:'#101114',title:'MakerFox Studio 2.0.0',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow.loadURL('makerfox://app/index.html');
 mainWindow.on('closed',()=>{mainWindow=null;});
}
ipcMain.handle('makerfox:open-model', async (_event,payload)=>{
 try{
  if(!payload||!payload.buffer||typeof payload.fileName!=='string')return {ok:false,error:'No se recibió un archivo válido.'};
  const extension=path.extname(payload.fileName).toLowerCase(),allowed=new Set(['.3mf','.stl','.obj','.step','.stp']);
  if(!allowed.has(extension))return {ok:false,error:'Formato no admitido.'};
  const safeName=path.basename(payload.fileName).replace(/[<>:"/\\|?*]/g,'_');
  const dir=path.join(app.getPath('temp'),'MakerFoxStudio-opened-models');await fs.promises.mkdir(dir,{recursive:true});
  const dest=path.join(dir,`${Date.now()}-${safeName}`);await fs.promises.writeFile(dest,Buffer.from(payload.buffer));
  const error=await shell.openPath(dest);if(error)return {ok:false,error};
  return {ok:true};
 }catch(e){return {ok:false,error:e.message||'No se pudo abrir el archivo.'}}
});
ipcMain.handle('makerfox:install-update', async ()=>{ if (!app.isPackaged) return { ok:false, message:'La instalación de actualizaciones requiere la versión instalada.' }; if (!updateDownloaded) return { ok:false, message:'La actualización todavía no termina de descargarse.' }; sendUpdateStatus('installing','Preparando instalación. MakerFox se cerrará y volverá a abrir automáticamente...'); autoUpdater.quitAndInstall(false,true); return { ok:true, message:'Instalando actualización...' }; });
ipcMain.handle('makerfox:check-updates', async ()=>{
 if (!app.isPackaged) return { ok:false, message:'La búsqueda de actualizaciones funciona en la versión instalada, no desde el modo de desarrollo.' };
 try { await autoUpdater.checkForUpdates(); return { ok:true, message:'Buscando actualizaciones...' }; }
 catch (e) { return { ok:false, message:e.message || 'No se pudo buscar actualizaciones.' }; }
});
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on('checking-for-update',()=>sendUpdateStatus('checking','Buscando actualizaciones...'));
autoUpdater.on('update-available',info=>sendUpdateStatus('available',`Nueva versión ${info.version} encontrada. Se está descargando...`,{version:info.version}));
autoUpdater.on('update-not-available',()=>sendUpdateStatus('current','MakerFox está actualizado.'));
autoUpdater.on('download-progress',p=>sendUpdateStatus('downloading',`Descargando actualización: ${Math.round(p.percent)}%`,{percent:Math.round(p.percent),transferred:p.transferred,total:p.total,bytesPerSecond:p.bytesPerSecond}));
autoUpdater.on('update-downloaded',info=>{ updateDownloaded=true; sendUpdateStatus('downloaded',`La versión ${info.version} está lista. Pulsa “Instalar y reiniciar”; MakerFox se cerrará y abrirá automáticamente.`,{version:info.version,percent:100}); });
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
