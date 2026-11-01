const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme:'makerfox', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true} }]);
function createWindow(){
 const win = new BrowserWindow({
  width:1450,height:940,minWidth:900,minHeight:650,
  backgroundColor:'#101114',
  title:'MakerFox',
  webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}
 });
 win.loadURL('makerfox://app/index.html');
}
app.whenReady().then(()=>{
 protocol.handle('makerfox',request=>{
  const url=new URL(request.url);
  const requested=decodeURIComponent(url.pathname);
  const target=path.join(__dirname,requested.replace(/^\/+/,''));
  const root=path.resolve(__dirname);
  if(!target.startsWith(root)) return new Response('Forbidden',{status:403});
  return net.fetch(pathToFileURL(target).toString());
 });
 createWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
