import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  INSTALLER_FILENAME,
  resolveInstallerOutputDir,
  resolvePackagedAppDir,
} from "./release-output-paths.mjs";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const packageDir = resolvePackagedAppDir(projectRoot);
const installerScriptTemplatePath = path.join(projectRoot, "scripts", "installer", "dude-tax.iss");
const installerOutputDir = resolveInstallerOutputDir(projectRoot);
const installerScriptPath = path.join(installerOutputDir, "dude-tax.generated.iss");
const outputBaseFilename = INSTALLER_FILENAME.replace(/\.exe$/i, "");
const setupIconPath = path.join(projectRoot, "apps", "desktop", "assets", "app-icon.ico");

const detectIscc = async () => {
  const candidates = [
    process.env.ISCC_PATH,
    "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Inno Setup 6", "ISCC.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  try {
    const { stdout } = await execFileAsync("where.exe", ["ISCC.exe"], {
      cwd: projectRoot,
      windowsHide: true,
    });
    const firstMatch = stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(Boolean);
    if (firstMatch) {
      return firstMatch;
    }
  } catch {
    // continue
  }

  throw new Error(
    "未找到 Inno Setup 编译器 ISCC.exe，请先安装 Inno Setup 6，或通过 ISCC_PATH 指定路径。",
  );
};

const normalizeVersionForWindows = (version) => {
  const corePart = String(version).split("-")[0] ?? "0.1.0";
  const segments = corePart.split(".").map((value) => Number.parseInt(value, 10));
  while (segments.length < 4) {
    segments.push(0);
  }
  return segments.slice(0, 4).join(".");
};

await access(packageDir).catch(() => {
  throw new Error(`未找到 Windows 打包目录：${packageDir}，请先执行 npm run package:win`);
});

await mkdir(installerOutputDir, { recursive: true });
await rm(installerScriptPath, { force: true });

const issTemplate = await readFile(installerScriptTemplatePath, "utf8");
const issContent = issTemplate
  .replaceAll("__APP_VERSION__", packageJson.version)
  .replaceAll("__VERSION_INFO__", normalizeVersionForWindows(packageJson.version))
  .replaceAll("__SOURCE_DIR__", packageDir.replaceAll("\\", "\\\\"))
  .replaceAll("__SETUP_ICON_FILE__", setupIconPath.replaceAll("\\", "\\\\"))
  .replaceAll("__OUTPUT_DIR__", installerOutputDir.replaceAll("\\", "\\\\"))
  .replaceAll("__OUTPUT_BASE_FILENAME__", outputBaseFilename);

await writeFile(installerScriptPath, issContent, "utf8");

const isccPath = await detectIscc();
await execFileAsync(isccPath, [installerScriptPath], {
  cwd: projectRoot,
  windowsHide: true,
  maxBuffer: 32 * 1024 * 1024,
});

process.stdout.write(
  `Windows installer output: ${path.join(installerOutputDir, `${outputBaseFilename}.exe`)}\n`,
);
