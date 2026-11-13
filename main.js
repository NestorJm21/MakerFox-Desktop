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
    const response=await fetch('https://geocodes.envia.com/zipcode/MX/'+cp,{headers:{'Accept':'application/json'}});
    const raw=await response.text();
    let body={};
    try{body=JSON.parse(raw)}catch{return {ok:false,error:'Envia devolvió una respuesta que no es JSON (HTTP '+response.status+').'};}
    if(!response.ok||body.success===false) return {ok:false,error:body.message||body.error||('Envia no pudo validar el CP (HTTP '+response.status+').')};
    let item=body.data??body;
    if(Array.isArray(item)) item=item[0]||{};
    if(item?.data) item=Array.isArray(item.data)?(item.data[0]||{}):item.data;
    const cityValue=item.city||item.locality||item.municipality||item.town||'';
    const stateValue=item.state||item.stateCode||item.province||'';
    const city=typeof cityValue==='string'?cityValue:(cityValue?.name||cityValue?.city||cityValue?.label||'');
    const state=typeof stateValue==='string'?stateValue:(stateValue?.name||stateValue?.state||stateValue?.stateName||stateValue?.label||stateValue?.description||'');
    if(!city||!state) return {ok:false,error:'Envia respondió sin ciudad o estado legible. Revisa el CP o captura ciudad y estado manualmente.'};
    return {ok:true,data:{...item,city,state,postalCode:item.postalCode||item.zipcode||cp}};
  }catch(e){return {ok:false,error:e.message||'No se pudo validar el código postal.'};}
});
ipcMain.handle('makerfox:envia-rate', async (_event, payload)=>{
  try{
    const token=await readEnviaToken();
    if(!token) return {ok:false,error:'Primero configura tu token de Envia en Ajustes.'};
    if(!payload||!payload.origin||!payload.destination||!Array.isArray(payload.packages)||!payload.packages.length) return {ok:false,error:'Faltan datos de origen, destino o paquete.'};
    const normalizeState=(value)=>{
      const map={'Chihuahua':'CH','Durango':'DG','Coahuila':'CO','Sonora':'SO','Sinaloa':'SI','Nuevo León':'NL','Nuevo Leon':'NL','Jalisco':'JA','Ciudad de México':'CX','CDMX':'CX'};
      return map[value]||value;
    };
    const requestPayload={
      origin:{...payload.origin,state:normalizeState(payload.origin.state)},
      destination:{...payload.destination,state:normalizeState(payload.destination.state)},
      packages:payload.packages,
      shipment:{type:1}
    };
    const response=await fetch('https://api.envia.com/ship/rate/',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(requestPayload)
    });
    const raw=await response.text();
    let body={};
    try{body=JSON.parse(raw)}catch{return {ok:false,error:'Envia devolvió una respuesta no válida (HTTP '+response.status+').'};}
    if(!response.ok) return {ok:false,error:body.message||body.error||JSON.stringify(body.errors||body)||('Error HTTP '+response.status)};
    const list=Array.isArray(body.data)?body.data:(Array.isArray(body.rates)?body.rates:(Array.isArray(body)?body:[]));
    const rates=list.map(rate=>({
      carrier:rate.carrier||rate.carrierName||'Transportista',
      service:rate.service||rate.serviceDescription||'Servicio',
      serviceDescription:rate.serviceDescription||rate.service||'Servicio',
      totalPrice:Number(rate.totalPrice??rate.total??rate.price??0),
      currency:rate.currency||'MXN',
      deliveryEstimate:rate.deliveryEstimate||rate.deliveryTime||rate.deliveryDays||'No especificado'
    })).filter(x=>Number.isFinite(x.totalPrice)&&x.totalPrice>0);
    if(!rates.length) return {ok:true,rates:[],diagnostic:body.message||body.meta||'La API respondió correctamente, pero no devolvió servicios para los datos enviados.',responseKeys:Object.keys(body||{})};
    return {ok:true,rates};
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
