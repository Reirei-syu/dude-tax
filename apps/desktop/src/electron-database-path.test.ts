import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  getInstallDirectoryDatabasePath,
  getLegacyUserDataDatabasePath,
  resolveManagedApiDatabasePath,
} = require("../electron/database-path.cjs") as {
  getInstallDirectoryDatabasePath: (executablePath: string) => string;
  getLegacyUserDataDatabasePath: (userDataPath: string) => string;
  resolveManagedApiDatabasePath: (input: {
    explicitDatabasePath?: string;
    executablePath: string;
    userDataPath: string;
    io?: {
      existsSync: (targetPath: string) => boolean;
      mkdirSync: (targetPath: string, options?: { recursive?: boolean }) => void;
      writeFileSync: (targetPath: string, content: string | Uint8Array) => void;
      rmSync: (targetPath: string, options?: { force?: boolean }) => void;
      copyFileSync: (sourcePath: string, targetPath: string) => void;
    };
  }) => {
    databasePath: string;
    source: "env" | "installDir" | "userDataFallback";
    migratedFromLegacy: boolean;
    fallbackReason: string | null;
  };
};

test("explicit DUDE_TAX_DB_PATH overrides install and legacy paths", () => {
  const explicitDatabasePath = path.join("D:\\", "custom", "db", "override.db");
  const resolution = resolveManagedApiDatabasePath({
    explicitDatabasePath,
    executablePath: path.join("D:\\", "Program Files", "DudeTax", "dude-tax.exe"),
    userDataPath: path.join("C:\\", "Users", "tester", "AppData", "Roaming", "DudeTax"),
  });

  assert.equal(resolution.databasePath, path.resolve(explicitDatabasePath));
  assert.equal(resolution.source, "env");
  assert.equal(resolution.migratedFromLegacy, false);
  assert.equal(resolution.fallbackReason, null);
});

test("migrates legacy userData database into install directory when install location is writable", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dude-tax-electron-db-"));
  const installDir = path.join(tempRoot, "install");
  const userDataDir = path.join(tempRoot, "user-data");
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const executablePath = path.join(installDir, "dude-tax.exe");
  const legacyDatabasePath = getLegacyUserDataDatabasePath(userDataDir);
  fs.mkdirSync(path.dirname(legacyDatabasePath), { recursive: true });
  fs.writeFileSync(legacyDatabasePath, "legacy-db");
  fs.writeFileSync(`${legacyDatabasePath}-wal`, "legacy-wal");
  fs.writeFileSync(`${legacyDatabasePath}-shm`, "legacy-shm");

  const resolution = resolveManagedApiDatabasePath({
    executablePath,
    userDataPath: userDataDir,
  });

  const installDatabasePath = getInstallDirectoryDatabasePath(executablePath);
  assert.equal(resolution.databasePath, installDatabasePath);
  assert.equal(resolution.source, "installDir");
  assert.equal(resolution.migratedFromLegacy, true);
  assert.equal(resolution.fallbackReason, null);
  assert.equal(fs.readFileSync(installDatabasePath, "utf8"), "legacy-db");
  assert.equal(fs.readFileSync(`${installDatabasePath}-wal`, "utf8"), "legacy-wal");
  assert.equal(fs.readFileSync(`${installDatabasePath}-shm`, "utf8"), "legacy-shm");
});

test("falls back to legacy userData path when install directory is not writable", () => {
  const executablePath = path.join("D:\\", "Program Files", "DudeTax", "dude-tax.exe");
  const userDataPath = path.join("C:\\", "Users", "tester", "AppData", "Roaming", "DudeTax");
  const writtenProbePaths: string[] = [];

  const resolution = resolveManagedApiDatabasePath({
    executablePath,
    userDataPath,
    io: {
      existsSync: () => false,
      mkdirSync: () => undefined,
      writeFileSync: (targetPath) => {
        writtenProbePaths.push(targetPath);
        throw new Error("permission denied");
      },
      rmSync: () => undefined,
      copyFileSync: () => undefined,
    },
  });

  assert.deepEqual(writtenProbePaths, [path.join(path.dirname(executablePath), "data", ".write-test")]);
  assert.equal(resolution.databasePath, getLegacyUserDataDatabasePath(userDataPath));
  assert.equal(resolution.source, "userDataFallback");
  assert.equal(resolution.migratedFromLegacy, false);
  assert.equal(resolution.fallbackReason, "install_directory_not_writable");
});
