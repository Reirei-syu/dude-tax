import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const electronMainSource = fs.readFileSync(
  path.join(process.cwd(), "electron", "main.cjs"),
  "utf8",
);

test("桌面主进程会把本地 API 地址注入到窗口 URL 查询参数中", () => {
  assert.equal(electronMainSource.includes("buildRendererUrl"), true);
  assert.equal(electronMainSource.includes("salaryTaxApiBaseUrl"), true);
  assert.equal(electronMainSource.includes("mainWindow.loadFile(path.join(__dirname, \"../dist/index.html\"), {"), true);
});
