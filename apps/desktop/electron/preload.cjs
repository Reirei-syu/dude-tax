const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("salaryTaxDesktop", {
  version: "0.1.0",
});

