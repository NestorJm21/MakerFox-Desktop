const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('makerfoxDesktop',{ platform:process.platform, version:'1.0.0' });
