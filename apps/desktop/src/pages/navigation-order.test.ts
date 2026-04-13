import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_NAV_ITEMS } from "@dude-tax/config";

test("导航顺序与政策参考命名符合新模块规划", () => {
  assert.deepEqual(
    MODULE_NAV_ITEMS.map((item) => item.path),
    [
      "/",
      "/units",
      "/employees",
      "/quick-calc",
      "/entry",
      "/result-confirmation",
      "/history",
      "/policy",
      "/maintenance",
    ],
  );

  assert.equal(
    MODULE_NAV_ITEMS.find((item) => item.path === "/policy")?.label,
    "政策参考",
  );
  assert.equal(
    MODULE_NAV_ITEMS.find((item) => item.path === "/result-confirmation")?.label,
    "缴纳确认",
  );
});
