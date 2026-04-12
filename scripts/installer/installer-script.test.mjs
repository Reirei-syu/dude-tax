import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const installerScriptSource = fs.readFileSync(
  path.join(process.cwd(), "scripts", "installer", "dude-tax.iss"),
  "utf8",
);

test("安装脚本会复用已安装目录并禁用 Inno 默认关应用弹窗", () => {
  assert.equal(installerScriptSource.includes("UsePreviousAppDir=yes"), true);
  assert.equal(installerScriptSource.includes("CloseApplications=no"), true);
  assert.equal(installerScriptSource.includes("RestartApplications=no"), true);
});

test("安装脚本会在安装前强制关闭正在运行的 dude-tax 进程树", () => {
  assert.equal(installerScriptSource.includes("function PrepareToInstall"), true);
  assert.equal(installerScriptSource.includes('taskkill /IM "dude-tax.exe" /T /F'), true);
});
