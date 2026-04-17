import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const apiSourceDir = path.join(process.cwd(), "src");

test("database module opens the explicit DUDE_TAX_DB_PATH in development flows", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dude-tax-api-db-"));
  const devDatabasePath = path.join(tempRoot, "data", "dev", "dude-tax.dev.db");

  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--eval",
      `
        process.chdir(${JSON.stringify(apiSourceDir)});
        const module = await import("./db/database.ts");
        process.stdout.write(String(module.databaseFilePath ?? ""));
        module.closeDatabase?.();
      `,
    ],
    {
      cwd: apiSourceDir,
      env: {
        ...process.env,
        DUDE_TAX_DB_PATH: devDatabasePath,
      },
      encoding: "utf8",
    },
  );

  assert.equal(output.trim(), path.resolve(devDatabasePath));
  assert.equal(fs.existsSync(devDatabasePath), true);
});
