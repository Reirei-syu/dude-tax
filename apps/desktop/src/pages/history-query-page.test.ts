import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const historyQueryPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "HistoryQueryPage.tsx"),
  "utf8",
);

test("历史查询页主工作区卡片接入共享折叠组件", () => {
  assert.equal(historyQueryPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(historyQueryPageSource.includes('title="历史查询"'), true);
  assert.equal(historyQueryPageSource.includes("listConfirmedResults(unitId, taxYear)"), true);
  assert.equal(historyQueryPageSource.includes("YearRecordWorkspaceDialog"), true);
});
