import path from "node:path";
import process from "node:process";

export const LOCAL_RELEASE_OUTPUT_ROOT = "D:\\coding\\completed\\dude-tax";
export const INSTALLER_FILENAME = "dude-tax-installer-x64.exe";
export const PACKAGED_APP_DIRNAME = "dude-tax-win32-x64";

export const resolveReleaseOutputRoot = (projectRoot = process.cwd()) => {
  const overrideOutputRoot = process.env.DUDE_TAX_PACKAGE_OUTPUT_DIR?.trim();
  if (overrideOutputRoot) {
    return overrideOutputRoot;
  }

  if (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true") {
    return path.join(projectRoot, "dist-electron");
  }

  return LOCAL_RELEASE_OUTPUT_ROOT;
};

export const resolvePackagedAppDir = (projectRoot = process.cwd()) =>
  path.join(resolveReleaseOutputRoot(projectRoot), PACKAGED_APP_DIRNAME);

export const resolveInstallerOutputDir = (projectRoot = process.cwd()) =>
  resolveReleaseOutputRoot(projectRoot);

export const resolveInstallerPath = (projectRoot = process.cwd()) =>
  path.join(resolveInstallerOutputDir(projectRoot), INSTALLER_FILENAME);
