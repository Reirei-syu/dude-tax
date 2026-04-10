import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.join(currentDir, "dist-runtime");
const publicDistDir = path.join(currentDir, "dist");
const tsconfigBuildPath = path.join(currentDir, "tsconfig.build.json");
const tscCliPath = path.join(currentDir, "..", "..", "node_modules", "typescript", "bin", "tsc");
const defaultPolicyContentSourcePath = path.join(currentDir, "src", "default-policy-content.json");
const defaultPolicyContentTargetPath = path.join(
  runtimeDir,
  "apps",
  "api",
  "src",
  "default-policy-content.json",
);

const rewriteRuntimeImports = async (targetDir, replacements) => {
  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await rewriteRuntimeImports(absolutePath, replacements);
      continue;
    }

    if (!entry.isFile() || !absolutePath.endsWith(".js")) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    let updated = content;
    for (const [from, to] of replacements) {
      updated = updated.replaceAll(`"${from}"`, `"${to}"`);
      updated = updated.replaceAll(`'${from}'`, `'${to}'`);
    }

    if (updated !== content) {
      await writeFile(absolutePath, updated, "utf8");
    }
  }
};

await rm(runtimeDir, { recursive: true, force: true });
await rm(publicDistDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await mkdir(publicDistDir, { recursive: true });

await execFileAsync(process.execPath, [tscCliPath, "-p", tsconfigBuildPath], {
  cwd: currentDir,
});

await copyFile(defaultPolicyContentSourcePath, defaultPolicyContentTargetPath);

const compiledApiDir = path.join(runtimeDir, "apps", "api", "src");
const compiledApiDirStats = await stat(compiledApiDir).catch(() => null);
if (!compiledApiDirStats?.isDirectory()) {
  throw new Error(`未找到 API 编译产物目录：${compiledApiDir}`);
}

await rewriteRuntimeImports(compiledApiDir, [
  ["@dude-tax/core", "../../../../packages/core/src/index.js"],
  ["@dude-tax/config", "../../../../packages/config/src/index.js"],
]);

const compiledCoreDir = path.join(runtimeDir, "packages", "core", "src");
const compiledCoreDirStats = await stat(compiledCoreDir).catch(() => null);
if (!compiledCoreDirStats?.isDirectory()) {
  throw new Error(`未找到 core 编译产物目录：${compiledCoreDir}`);
}

await rewriteRuntimeImports(compiledCoreDir, [["@dude-tax/config", "../../config/src/index.js"]]);

await writeFile(
  path.join(publicDistDir, "server.mjs"),
  'import "../dist-runtime/apps/api/src/server.js";\n',
  "utf8",
);

process.stdout.write(`API runtime build output: ${path.join(publicDistDir, "server.mjs")}\n`);
