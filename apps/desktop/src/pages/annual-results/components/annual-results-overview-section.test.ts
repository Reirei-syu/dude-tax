import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const annualResultsOverviewSectionSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "annual-results", "components", "AnnualResultsOverviewSection.tsx"),
  "utf8",
);

test("年度结果总览区保留进入计算中心入口并指向 calculation 路由别名", () => {
  assert.equal(annualResultsOverviewSectionSource.includes("前往计算中心"), true);
  assert.equal(
    annualResultsOverviewSectionSource.includes('<Link className="ghost-button link-button" to="/calculation">'),
    true,
  );
});
