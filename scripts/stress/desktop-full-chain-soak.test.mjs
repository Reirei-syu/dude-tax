import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), "scripts", "stress", "desktop-full-chain-soak.mjs");

test("压测脚本在缺少参数时输出结构化错误 JSON", async () => {
  await assert.rejects(
    async () => {
      await execFileAsync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
      });
    },
    (error) => {
      const output = JSON.parse(String(error.stdout).trim());
      assert.equal(output.status, "error");
      assert.equal(typeof output.error, "string");
      assert.match(output.error, /--api-base-url|--db-path|--output-dir|--unit-name|--duration-minutes/);
      return true;
    },
  );
});

test("压测脚本在 API 不可达时输出 status=error", async () => {
  const tempDir = path.join(os.tmpdir(), `dude-tax-stress-cli-${Date.now()}`);
  const dbPath = path.join(tempDir, "stress.db");
  const outputDir = path.join(tempDir, "artifacts");

  await assert.rejects(
    async () => {
      await execFileAsync(
        process.execPath,
        [
          scriptPath,
          "--duration-minutes",
          "0.01",
          "--api-base-url",
          "http://127.0.0.1:9",
          "--db-path",
          dbPath,
          "--seed-employees",
          "1",
          "--tax-year",
          "2026",
          "--unit-name",
          "压测测试单位",
          "--output-dir",
          outputDir,
          "--phase-profile",
          "desktop-full-chain",
        ],
        {
          cwd: process.cwd(),
        },
      );
    },
    (error) => {
      const output = JSON.parse(String(error.stdout).trim());
      assert.equal(output.status, "error");
      assert.equal(output.data, null);
      assert.equal(typeof output.error, "string");
      return true;
    },
  );
});
