import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLinePrefixEdit,
  applyWrapEdit,
  parseMaintenanceRichText,
} from "./maintenance-rich-text";

test("富文本解析支持标题、列表、引用和段落", () => {
  const blocks = parseMaintenanceRichText(`# 主标题

- 第一项
- 第二项

> 提示说明

普通段落`);

  assert.equal(blocks[0]?.type, "heading");
  assert.equal(blocks[1]?.type, "list");
  assert.equal(blocks[2]?.type, "quote");
  assert.equal(blocks[3]?.type, "paragraph");
});

test("行前缀编辑可批量添加列表前缀", () => {
  const result = applyLinePrefixEdit("第一行\n第二行", 0, 5, "- ");

  assert.equal(result.nextText, "- 第一行\n- 第二行");
  assert.equal(result.nextSelectionStart, 2);
});

test("包裹编辑可为选中文本添加强调标记", () => {
  const result = applyWrapEdit("说明文本", 0, 4, "**", "**");

  assert.equal(result.nextText, "**说明文本**");
  assert.equal(result.nextSelectionStart, 2);
  assert.equal(result.nextSelectionEnd, 6);
});
