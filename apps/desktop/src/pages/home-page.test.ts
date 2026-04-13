import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const homePageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "HomePage.tsx"),
  "utf8",
);

test("首页工作区卡片接入共享折叠组件，并默认折叠当前税率表", () => {
  assert.equal(homePageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(homePageSource.includes('title="首页"'), true);
  assert.equal(homePageSource.includes('title="工作提醒"'), false);
  assert.equal(homePageSource.includes('title="工作建议"'), false);
  assert.equal(homePageSource.includes('title="政策口径"'), true);
  assert.equal(homePageSource.includes("前往政策参考"), true);
  assert.equal(homePageSource.includes('<Link className="primary-button link-button" to="/policy">'), true);
  assert.equal(homePageSource.includes("policyItems.length"), true);
  assert.equal(homePageSource.includes('title="当前税率表"'), true);
  assert.equal(homePageSource.includes("defaultCollapsed"), true);
});
