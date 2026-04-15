import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const importWorkflowSectionSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "ImportWorkflowSection.tsx"),
  "utf8",
);

const desktopStylesSource = fs.readFileSync(
  path.join(process.cwd(), "src", "styles.css"),
  "utf8",
);

test("批量导入工作区折叠时通过 hidden 控制内容区显示", () => {
  assert.equal(importWorkflowSectionSource.includes("collapseStateKey"), true);
  assert.equal(importWorkflowSectionSource.includes("useWorkspaceCollapseState"), true);
  assert.equal(
    importWorkflowSectionSource.includes('hidden={isGroupCollapsed}'),
    true,
  );
  assert.equal(
    desktopStylesSource.includes(".import-workflow-group-body[hidden]"),
    true,
  );
  assert.equal(desktopStylesSource.includes("display: none;"), true);
});
