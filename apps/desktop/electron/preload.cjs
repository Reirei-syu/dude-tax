const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("salaryTaxDesktop", {
  version: "0.1.0",
  saveFile: (input) => ipcRenderer.invoke("salary-tax:save-file", input),
});
