import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import packager from "@electron/packager";
import { rebuild } from "@electron/rebuild";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "dist-electron");
const desktopPackageJson = JSON.parse(
  await readFile(path.join(projectRoot, "apps", "desktop", "package.json"), "utf8"),
);
const electronVersion =
  desktopPackageJson?.devDependencies?.electron?.replace(/^[^\d]*/, "") ?? "37.5.1";

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await rebuild({
  buildPath: projectRoot,
  electronVersion,
  onlyModules: ["better-sqlite3"],
});

await packager({
  dir: projectRoot,
  name: "dude-tax",
  executableName: "dude-tax",
  out: outputDir,
  overwrite: true,
  platform: "win32",
  arch: "x64",
  asar: false,
  derefSymlinks: true,
  prune: false,
  electronVersion,
  ignore: [
    /^\/dist-electron($|\/)/,
    /^\/\.git($|\/)/,
    /^\/coverage($|\/)/,
    /^\/tmp($|\/)/,
    /^\/data\/test($|\/)/,
    /^\/docs\/plans($|\/)/,
  ],
  win32metadata: {
    CompanyName: "dude-tax",
    FileDescription: "工资薪金个税计算器",
    ProductName: "工资薪金个税计算器",
  },
});

process.stdout.write(`Windows 测试包已生成到 ${outputDir}\n`);
