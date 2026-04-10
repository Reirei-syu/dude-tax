import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const currentPolicyPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "CurrentPolicyPage.tsx"),
  "utf8",
);

test("政策参考页按多条政策说明渲染扣除项说明列表", () => {
  assert.equal(currentPolicyPageSource.includes("policy?.policyItems.length"), true);
  assert.equal(currentPolicyPageSource.includes("policy-item-list"), true);
  assert.equal(currentPolicyPageSource.includes("policy-item-card"), true);
  assert.equal(currentPolicyPageSource.includes("新增并填写说明条目"), true);
  assert.equal(currentPolicyPageSource.includes("selectedIllustration"), true);
  assert.equal(currentPolicyPageSource.includes("policy-illustration-button"), true);
  assert.equal(currentPolicyPageSource.includes("点击查看原图"), true);
  assert.equal(currentPolicyPageSource.includes("原图预览"), true);
  assert.equal(currentPolicyPageSource.includes("illustrationScale"), true);
  assert.equal(currentPolicyPageSource.includes("handleIllustrationWheel"), true);
  assert.equal(currentPolicyPageSource.includes("handleIllustrationPointerDown"), true);
  assert.equal(currentPolicyPageSource.includes("滚轮缩放，按住鼠标左键拖动图片。"), true);
  assert.equal(currentPolicyPageSource.includes("缩小"), true);
  assert.equal(currentPolicyPageSource.includes("放大"), true);
  assert.equal(currentPolicyPageSource.includes("重置"), true);
  assert.equal(currentPolicyPageSource.includes("policy-illustration-lightbox-viewport"), true);
});

test("政策参考页将税率表卡片接入共享折叠组件，并默认折叠两张税率表", () => {
  assert.equal(currentPolicyPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(currentPolicyPageSource.includes('title="政策参考"'), true);
  assert.equal(currentPolicyPageSource.includes('title="综合税率表"'), true);
  assert.equal(currentPolicyPageSource.includes('title="年终奖单独计税税率表"'), true);
  assert.equal(currentPolicyPageSource.includes('title="扣除项说明"'), true);
  assert.equal(currentPolicyPageSource.includes("defaultCollapsed"), true);
});
