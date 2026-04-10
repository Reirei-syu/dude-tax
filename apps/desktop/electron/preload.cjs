const { contextBridge, ipcRenderer } = require("electron");

const readRuntimeArgument = (key) => {
  const prefix = `--${key}=`;
  const matchedArg = process.argv.find((value) => value.startsWith(prefix));
  return matchedArg ? matchedArg.slice(prefix.length) : "";
};

contextBridge.exposeInMainWorld("salaryTaxDesktop", {
  version: "0.1.0",
  runtimeConfig: {
    apiBaseUrl: readRuntimeArgument("salary-tax-api-base-url"),
    managedApi: readRuntimeArgument("salary-tax-managed-api") === "1",
    databasePath: readRuntimeArgument("salary-tax-db-path"),
  },
  pickSavePath: (input) => ipcRenderer.invoke("salary-tax:pick-save-path", input),
  saveFile: (input) => ipcRenderer.invoke("salary-tax:save-file", input),
});
