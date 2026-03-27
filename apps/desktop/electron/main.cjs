const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let managedApiProcess = null;
let isShuttingDown = false;

const isDevelopmentRenderer = Boolean(process.env.ELECTRON_RENDERER_URL);

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

const probePort = (preferredPort) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (preferredPort !== 0) {
        resolve(0);
        return;
      }

      reject(error);
    });
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();
      const availablePort = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(availablePort);
      });
    });
  });

const findAvailablePort = async (preferredPort = 3001) => {
  const preferredMatch = await probePort(preferredPort);
  if (preferredMatch) {
    return preferredMatch;
  }

  return probePort(0);
};

const waitForApiHealth = (apiBaseUrl, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const ping = () => {
      const request = http.get(`${apiBaseUrl}/api/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
          return;
        }

        retry();
      });

      request.on("error", retry);
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("本地 API 在限定时间内未就绪"));
        return;
      }

      setTimeout(ping, 250);
    };

    ping();
  });

const appendManagedApiLog = (logPath, prefix, chunk) => {
  const message = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  fsSync.mkdirSync(path.dirname(logPath), { recursive: true });
  fsSync.appendFileSync(logPath, `[${new Date().toISOString()}] ${prefix}${message}`);
};

const buildRuntimeConfig = (input) => ({
  apiBaseUrl: input.apiBaseUrl,
  managedApi: input.managedApi,
  databasePath: input.databasePath ?? "",
});

const startManagedApi = async () => {
  if (process.env.SALARY_TAX_API_BASE_URL) {
    return buildRuntimeConfig({
      apiBaseUrl: process.env.SALARY_TAX_API_BASE_URL,
      managedApi: false,
      databasePath: process.env.DUDE_TAX_DB_PATH,
    });
  }

  if (isDevelopmentRenderer) {
    return buildRuntimeConfig({
      apiBaseUrl: process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001",
      managedApi: false,
      databasePath: process.env.DUDE_TAX_DB_PATH,
    });
  }

  const port = await findAvailablePort(3001);
  const apiBaseUrl = `http://127.0.0.1:${port}`;
  const databasePath = path.join(app.getPath("userData"), "data", "dude-tax.db");
  const apiEntryPath = path.join(app.getAppPath(), "apps", "api", "src", "server.ts");
  const tsxCliPath = path.join(app.getAppPath(), "node_modules", "tsx", "dist", "cli.mjs");
  const logPath = path.join(app.getPath("userData"), "logs", "managed-api.log");

  managedApiProcess = spawn(process.execPath, [tsxCliPath, apiEntryPath], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOST: "127.0.0.1",
      PORT: String(port),
      DUDE_TAX_DB_PATH: databasePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  managedApiProcess.stdout?.on("data", (chunk) => appendManagedApiLog(logPath, "[stdout] ", chunk));
  managedApiProcess.stderr?.on("data", (chunk) => appendManagedApiLog(logPath, "[stderr] ", chunk));

  managedApiProcess.once("exit", (code) => {
    if (!isShuttingDown && code !== 0) {
      dialog.showErrorBox("本地服务异常退出", `本地 API 已退出，退出码：${String(code ?? "未知")}`);
    }
  });

  await waitForApiHealth(apiBaseUrl);

  return buildRuntimeConfig({
    apiBaseUrl,
    managedApi: true,
    databasePath,
  });
};

const stopManagedApi = () =>
  new Promise((resolve) => {
    if (!managedApiProcess || managedApiProcess.killed) {
      managedApiProcess = null;
      resolve();
      return;
    }

    const apiProcess = managedApiProcess;
    managedApiProcess = null;
    apiProcess.once("exit", () => resolve());
    apiProcess.kill();
  });

const createWindow = (runtimeConfig) => {
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
      additionalArguments: [
        `--salary-tax-api-base-url=${runtimeConfig.apiBaseUrl}`,
        `--salary-tax-managed-api=${runtimeConfig.managedApi ? "1" : "0"}`,
        `--salary-tax-db-path=${runtimeConfig.databasePath}`,
      ],
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

app.whenReady().then(async () => {
  try {
    const runtimeConfig = await startManagedApi();

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

    createWindow(runtimeConfig);

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(runtimeConfig);
      }
    });
  } catch (error) {
    dialog.showErrorBox(
      "应用启动失败",
      error instanceof Error ? error.message : "本地服务初始化失败",
    );
    app.quit();
  }
});

app.on("before-quit", () => {
  isShuttingDown = true;
  void stopManagedApi();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
