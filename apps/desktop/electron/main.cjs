const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const isAppNavigationTarget = (url) => {
  if (process.env.ELECTRON_RENDERER_URL) {
    try {
      return new URL(url).origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
    } catch {
      return false;
    }
  }

  return url.startsWith("file://");
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#f2f7ff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppNavigationTarget(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(() => {
  ipcMain.handle("salary-tax:save-file", async (_event, input) => {
    const result = await dialog.showSaveDialog({
      defaultPath: input.defaultPath,
      filters: input.filters,
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, Buffer.from(input.base64Content, "base64"));
    return {
      canceled: false,
      filePath: result.filePath,
    };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
