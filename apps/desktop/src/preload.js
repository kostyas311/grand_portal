const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('normbaseDesktop', {
  isDesktop: true,
  platform: process.platform,
});
