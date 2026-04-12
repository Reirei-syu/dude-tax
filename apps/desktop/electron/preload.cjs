const path = require("node:path");
const { contextBridge, ipcRenderer } = require("electron");

const rootPackageJson = require(path.join(__dirname, "..", "..", "..", "package.json"));

const readRuntimeArgument = (key) => {
  const prefix = `--${key}=`;
  const matchedArg = process.argv.find((value) => value.startsWith(prefix));
  return matchedArg ? matchedArg.slice(prefix.length) : "";
};

contextBridge.exposeInMainWorld("salaryTaxDesktop", {
  version: rootPackageJson.version,
  runtimeConfig: {
    apiBaseUrl: readRuntimeArgument("salary-tax-api-base-url"),
    managedApi: readRuntimeArgument("salary-tax-managed-api") === "1",
    databasePath: readRuntimeArgument("salary-tax-db-path"),
  },
  pickSavePath: (input) => ipcRenderer.invoke("salary-tax:pick-save-path", input),
  saveFile: (input) => ipcRenderer.invoke("salary-tax:save-file", input),
});
