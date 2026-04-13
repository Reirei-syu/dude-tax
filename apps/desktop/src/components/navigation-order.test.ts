import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_NAV_ITEMS } from "@dude-tax/config";
import { moveNavItemByStep, canMoveNavItem } from "./navigation-order";

test("导航排序 helper 支持按步移动并保持相对顺序", () => {
  const initialOrder = MODULE_NAV_ITEMS.map((item) => item.path);

  assert.deepEqual(
    moveNavItemByStep(initialOrder, "/employees", -1),
    ["/", "/employees", "/units", "/quick-calc", "/entry", "/result-confirmation", "/history", "/policy", "/maintenance"],
  );
  assert.deepEqual(
    moveNavItemByStep(initialOrder, "/units", 1),
    ["/", "/employees", "/units", "/quick-calc", "/entry", "/result-confirmation", "/history", "/policy", "/maintenance"],
  );
});

test("导航排序 helper 在边界位置禁用移动", () => {
  const initialOrder = MODULE_NAV_ITEMS.map((item) => item.path);

  assert.equal(canMoveNavItem(initialOrder, "/", -1), false);
  assert.equal(canMoveNavItem(initialOrder, "/maintenance", 1), false);
  assert.equal(canMoveNavItem(initialOrder, "/units", -1), true);
  assert.equal(canMoveNavItem(initialOrder, "/units", 1), true);
  assert.deepEqual(moveNavItemByStep(initialOrder, "/", -1), initialOrder);
  assert.deepEqual(moveNavItemByStep(initialOrder, "/maintenance", 1), initialOrder);
});

test("导航排序 helper 会归一化无效顺序并处理未知路径", () => {
  const dirtyOrder = ["/units", "/units", "/unknown", "/history"];

  assert.deepEqual(moveNavItemByStep(dirtyOrder, "/unknown", 1), [
    "/units",
    "/history",
    "/",
    "/employees",
    "/quick-calc",
    "/entry",
    "/result-confirmation",
    "/policy",
    "/maintenance",
  ]);
  assert.equal(canMoveNavItem(dirtyOrder, "/unknown", -1), false);
});
