import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import packager from "@electron/packager";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "dist-electron");
const iconPath = path.join(projectRoot, "apps", "desktop", "assets", "app-icon.ico");
const desktopPackageJson = JSON.parse(
  await readFile(path.join(projectRoot, "apps", "desktop", "package.json"), "utf8"),
);
const electronVersion =
  desktopPackageJson?.devDependencies?.electron?.replace(/^[^\d]*/, "") ?? "37.5.1";

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const prebuildInstallCli = path.join(
  projectRoot,
  "node_modules",
  "prebuild-install",
  "bin.js",
);

const prepareBetterSqliteForElectron = (
  buildPath,
  _packagedElectronVersion,
  _platform,
  _arch,
  callback,
) => {
  execFileAsync(process.execPath, [
    prebuildInstallCli,
    "--runtime",
    "electron",
    "--target",
    electronVersion,
    "--arch",
    "x64",
    "--platform",
    "win32",
    "--force",
  ], {
    cwd: path.join(buildPath, "node_modules", "better-sqlite3"),
  })
    .then(() => callback())
    .catch((error) => callback(error));
};

await packager({
  dir: projectRoot,
  name: "dude-tax",
  executableName: "dude-tax",
  icon: iconPath,
  out: outputDir,
  overwrite: true,
  platform: "win32",
  arch: "x64",
  asar: false,
  derefSymlinks: true,
  prune: false,
  electronVersion,
  afterCopy: [prepareBetterSqliteForElectron],
  ignore: [
    /^\/dist-electron($|\/)/,
    /^\/\.git($|\/)/,
    /^\/\.github($|\/)/,
    /^\/\.codex($|\/)/,
    /^\/coverage($|\/)/,
    /^\/tmp($|\/)/,
    /^\/data($|\/)/,
    /^\/docs($|\/)/,
    /^\/scripts($|\/)/,
    /^\/AGENTS\.md$/,
    /^\/PENDING_GOALS\.md$/,
    /^\/PROGRESS\.md$/,
    /^\/PROJECT_SPEC\.md$/,
    /^\/prd\.md$/,
    /^\/package-lock\.json$/,
    /^\/apps\/api\/src($|\/)/,
    /^\/apps\/desktop\/src($|\/)/,
    /^\/packages\/core($|\/)/,
    /^\/packages\/config($|\/)/,
  ],
  win32metadata: {
    CompanyName: "dude-tax",
    FileDescription: "dude-tax desktop",
    ProductName: "dude-tax",
  },
});

process.stdout.write(`Windows test package output: ${outputDir}\n`);
