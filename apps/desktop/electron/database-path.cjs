const fs = require("node:fs");
const path = require("node:path");

const defaultIo = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  writeFileSync: fs.writeFileSync,
  rmSync: fs.rmSync,
  copyFileSync: fs.copyFileSync,
};

const getInstallDirectoryDatabasePath = (executablePath) =>
  path.join(path.dirname(executablePath), "data", "dude-tax.db");

const getLegacyUserDataDatabasePath = (userDataPath) =>
  path.join(userDataPath, "data", "dude-tax.db");

const ensureInstallDirectoryWritable = (databasePath, io) => {
  const databaseDirectory = path.dirname(databasePath);
  const probePath = path.join(databaseDirectory, ".write-test");

  try {
    io.mkdirSync(databaseDirectory, { recursive: true });
    io.writeFileSync(probePath, "ok");
    io.rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
};

const copyDatabaseCompanionIfExists = (sourcePath, targetPath, io) => {
  if (!io.existsSync(sourcePath)) {
    return;
  }

  io.copyFileSync(sourcePath, targetPath);
};

const migrateLegacyUserDataDatabaseIfNeeded = ({
  installDatabasePath,
  legacyDatabasePath,
  io,
}) => {
  if (io.existsSync(installDatabasePath) || !io.existsSync(legacyDatabasePath)) {
    return false;
  }

  io.mkdirSync(path.dirname(installDatabasePath), { recursive: true });
  io.copyFileSync(legacyDatabasePath, installDatabasePath);
  copyDatabaseCompanionIfExists(
    `${legacyDatabasePath}-wal`,
    `${installDatabasePath}-wal`,
    io,
  );
  copyDatabaseCompanionIfExists(
    `${legacyDatabasePath}-shm`,
    `${installDatabasePath}-shm`,
    io,
  );
  return true;
};

const resolveManagedApiDatabasePath = ({
  explicitDatabasePath,
  executablePath,
  userDataPath,
  io = defaultIo,
}) => {
  if (explicitDatabasePath) {
    return {
      databasePath: path.resolve(explicitDatabasePath),
      source: "env",
      migratedFromLegacy: false,
      fallbackReason: null,
    };
  }

  const installDatabasePath = getInstallDirectoryDatabasePath(executablePath);
  const legacyDatabasePath = getLegacyUserDataDatabasePath(userDataPath);

  if (ensureInstallDirectoryWritable(installDatabasePath, io)) {
    return {
      databasePath: installDatabasePath,
      source: "installDir",
      migratedFromLegacy: migrateLegacyUserDataDatabaseIfNeeded({
        installDatabasePath,
        legacyDatabasePath,
        io,
      }),
      fallbackReason: null,
    };
  }

  return {
    databasePath: legacyDatabasePath,
    source: "userDataFallback",
    migratedFromLegacy: false,
    fallbackReason: "install_directory_not_writable",
  };
};

module.exports = {
  getInstallDirectoryDatabasePath,
  getLegacyUserDataDatabasePath,
  resolveManagedApiDatabasePath,
};
