import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const electronMainSource = fs.readFileSync(
  path.join(process.cwd(), "electron", "main.cjs"),
  "utf8",
);

test("desktop main injects API base url into renderer query parameters", () => {
  assert.equal(electronMainSource.includes("buildRendererUrl"), true);
  assert.equal(electronMainSource.includes("salaryTaxApiBaseUrl"), true);
  assert.equal(
    electronMainSource.includes(
      'mainWindow.loadFile(path.join(__dirname, "../dist/index.html"), {',
    ),
    true,
  );
});

test("desktop main resolves managed API database path through helper", () => {
  assert.equal(electronMainSource.includes("resolveManagedApiDatabasePath"), true);
  assert.equal(electronMainSource.includes("databaseResolution.databasePath"), true);
});
