import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const collapsibleSectionCardSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "CollapsibleSectionCard.tsx"),
  "utf8",
);

test("共享折叠卡片组件支持默认折叠与可访问折叠控制", () => {
  assert.equal(collapsibleSectionCardSource.includes("defaultCollapsed = false"), true);
  assert.equal(collapsibleSectionCardSource.includes("aria-controls={contentId}"), true);
  assert.equal(collapsibleSectionCardSource.includes("aria-expanded={!isCollapsed}"), true);
  assert.equal(
    collapsibleSectionCardSource.includes('className="collapsible-card-body" hidden={isCollapsed}'),
    true,
  );
  assert.equal(collapsibleSectionCardSource.includes('{isCollapsed ? "展开" : "折叠"}'), true);
});
