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

// Delete the retired legacy shipping credential from this Studio profile.
void fs.promises.rm(path.join(app.getPath('userData'),'envia-token.enc'),{force:true}).catch(()=>{});
const drenvioTokenPath=()=>path.join(app.getPath('userData'),'drenvio-token.enc');
async function readDrenvioToken(){
 try{if(!safeStorage.isEncryptionAvailable())throw new Error('El cifrado seguro de Windows no está disponible.');const encrypted=await fs.promises.readFile(drenvioTokenPath());return safeStorage.decryptString(encrypted)}
 catch(e){if(e.code==='ENOENT')return '';throw e}
}
ipcMain.handle('makerfox:drenvio-save-token',async(_event,token)=>{
 try{if(!safeStorage.isEncryptionAvailable())return {ok:false,error:'El cifrado seguro de Windows no está disponible.'};if(typeof token!=='string'||token.trim().length<10)return {ok:false,error:'Introduce un token de prueba válido.'};await fs.promises.writeFile(drenvioTokenPath(),safeStorage.encryptString(token.trim()),{mode:0o600});return {ok:true}}
 catch(e){return {ok:false,error:e.message||'No se pudo guardar el token.'}}
});
ipcMain.handle('makerfox:drenvio-token-status',async()=>{try{return {ok:true,configured:!!(await readDrenvioToken())}}catch(e){return {ok:false,error:e.message}}});
ipcMain.handle('makerfox:drenvio-clear-token',async()=>{try{await fs.promises.rm(drenvioTokenPath(),{force:true});return {ok:true}}catch(e){return {ok:false,error:e.message}}});
ipcMain.handle('makerfox:drenvio-rate',async(_event,payload)=>{
 try{
  const token=await readDrenvioToken();if(!token)return {ok:false,error:'Primero guarda tu token Sandbox de DrEnvío en Ajustes.'};
  if(!payload?.originPostal||!payload?.destinationPostal||!Array.isArray(payload.packages)||!payload.packages.length)return {ok:false,error:'Faltan códigos postales o datos del paquete.'};
  const body={
   type:'National',
   origin:{country:'MX',postalCode:String(payload.originPostal),city:payload.originCity||undefined},
   destination:{country:'MX',postalCode:String(payload.destinationPostal),city:payload.destinationCity||undefined},
   packages:payload.packages.map(p=>({weight:Number(p.weight),height:Number(p.height),width:Number(p.width),length:Number(p.length),volumetric:Number(p.volumetric||0),type:'box'})),
   carriers:['jtexpress','quiken'],
   insurance:0
  };
  let response;
  try{
   response=await net.fetch('https://sandbox.api-drenvio.com/v2/shipments/rate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  }catch(networkError){
   const detail=networkError?.cause?.code||networkError?.code||networkError?.message||'Error de red desconocido';
   return {ok:false,error:'No se pudo conectar con DrEnvío Sandbox ('+detail+'). Revisa conexión, DNS o bloqueo de red.'};
  }
  const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{return {ok:false,error:'DrEnvío Sandbox respondió contenido no JSON (HTTP '+response.status+'): '+raw.slice(0,220)};}
  if(!response.ok)return {ok:false,error:data.message||data.error||JSON.stringify(data.errors||data)||('Error HTTP '+response.status)};
  const list=Array.isArray(data)?data:(Array.isArray(data.data)?data.data:(Array.isArray(data.rates)?data.rates:[]));
  const rates=list.map(x=>({carrier:x.carrier||'Transportista',service:x.service||x.service_id||'Servicio',serviceDescription:x.service_id||x.service||'Servicio',totalPrice:Number(x.price??x.totalPrice??0),currency:x.currency||'MXN',deliveryEstimate:x.days||'No especificado',serviceId:x.service_id||'',shippingId:x.ShippingId||x.shipping_id||''})).filter(x=>Number.isFinite(x.totalPrice)&&x.totalPrice>0);
  return {ok:true,rates,diagnostic:rates.length?'':'Sandbox únicamente simula servicios JTExpress y Quiken. No devolvió tarifas para estos datos.'};
 }catch(e){return {ok:false,error:'Error interno de DrEnvío: '+(e?.cause?.code||e?.code||e.message||'error desconocido')}}
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
