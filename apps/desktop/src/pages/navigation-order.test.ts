import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_NAV_ITEMS } from "@dude-tax/config";

test("当前政策导航位于历史查询和系统维护之间", () => {
  const paths = MODULE_NAV_ITEMS.map((item) => item.path);

  assert.deepEqual(paths.slice(-3), ["/history", "/policy", "/maintenance"]);
});
