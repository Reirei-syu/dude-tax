import assert from "node:assert/strict";
import test from "node:test";
import type {
  FloatingDialogLayout,
  WorkspaceCardLayout,
  WorkspaceLayoutState,
} from "@dude-tax/core";
import {
  alignCardToNearestNeighbor,
  autoArrangeWorkspaceCards,
  clampFloatingDialogLayout,
  clampWorkspaceContentScale,
  mergeLayoutState,
  normalizeNavigationOrder,
  resolveLayoutCollisions,
} from "./workspace-layout";

test("合并默认布局时保留已保存卡片位置并补齐缺失卡片", () => {
  const defaults: WorkspaceCardLayout[] = [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 10 },
    { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 10 },
  ];
  const storedState: WorkspaceLayoutState = {
    scope: "page:home",
    cards: [{ cardId: "overview", canvasId: "root", x: 2, y: 3, w: 7, h: 12 }],
  };

  const merged = mergeLayoutState("page:home", defaults, storedState);

  assert.deepEqual(merged, {
    scope: "page:home",
    cards: [
      { cardId: "overview", canvasId: "root", x: 2, y: 3, w: 7, h: 12 },
      { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 10 },
    ],
  });
});

test("左右关系的自动吸附会执行上对齐", () => {
  const aligned = alignCardToNearestNeighbor(
    [
      { cardId: "overview", canvasId: "root", x: 0, y: 2, w: 5, h: 8 },
      { cardId: "policy", canvasId: "root", x: 7, y: 5, w: 5, h: 8 },
    ],
    { cardId: "policy", canvasId: "root", x: 6, y: 9, w: 5, h: 8 },
  );

  assert.equal(aligned.y, 2);
});

test("上下关系的自动吸附会执行左对齐", () => {
  const aligned = alignCardToNearestNeighbor(
    [
      { cardId: "overview", canvasId: "root", x: 1, y: 0, w: 5, h: 8 },
      { cardId: "policy", canvasId: "root", x: 5, y: 12, w: 5, h: 8 },
    ],
    { cardId: "policy", canvasId: "root", x: 8, y: 9, w: 5, h: 8 },
  );

  assert.equal(aligned.x, 1);
});

test("碰撞修正会在工作区内向下推开重叠卡片", () => {
  const resolved = resolveLayoutCollisions(
    [
      { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 10 },
      { cardId: "policy", canvasId: "root", x: 0, y: 4, w: 6, h: 10 },
    ],
    "overview",
  );

  assert.deepEqual(resolved, [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 10 },
    { cardId: "policy", canvasId: "root", x: 0, y: 10, w: 6, h: 10 },
  ]);
});

test("轻微横向重叠时会优先微调宽度而不是上下堆叠", () => {
  const resolved = resolveLayoutCollisions(
    [
      { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 10, h: 10 },
      { cardId: "policy", canvasId: "root", x: 9, y: 0, w: 3, h: 10 },
    ],
    "policy",
  );

  assert.deepEqual(resolved, [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 10, h: 10 },
    { cardId: "policy", canvasId: "root", x: 10, y: 0, w: 2, h: 10 },
  ]);
});

test("卡片会自动向上回填，避免远离顶部状态栏", () => {
  const resolved = resolveLayoutCollisions(
    [
      { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 8 },
      { cardId: "policy", canvasId: "root", x: 6, y: 18, w: 6, h: 8 },
    ],
    "policy",
  );

  assert.deepEqual(resolved, [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 8 },
    { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 8 },
  ]);
});

test("自动排列会向上回填并尽量保留左右并排", () => {
  const arranged = autoArrangeWorkspaceCards([
    { cardId: "overview", canvasId: "root", x: 0, y: 12, w: 7, h: 8 },
    { cardId: "policy", canvasId: "root", x: 7, y: 16, w: 5, h: 8 },
    { cardId: "history", canvasId: "root", x: 0, y: 40, w: 12, h: 10 },
  ]);

  assert.deepEqual(arranged, [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 7, h: 8 },
    { cardId: "policy", canvasId: "root", x: 7, y: 0, w: 5, h: 8 },
    { cardId: "history", canvasId: "root", x: 0, y: 8, w: 12, h: 10 },
  ]);
});

test("弹窗布局会被裁剪到视口内并保留最小尺寸", () => {
  const layout: FloatingDialogLayout = {
    scope: "dialog:year-record-workspace",
    x: -80,
    y: -40,
    width: 200,
    height: 180,
    isMaximized: false,
  };

  assert.deepEqual(clampFloatingDialogLayout(layout, { width: 1280, height: 900 }), {
    scope: "dialog:year-record-workspace",
    x: 0,
    y: 0,
    width: 720,
    height: 360,
    isMaximized: false,
  });
});

test("导航顺序归一化会剔除未知路径并补齐缺失模块", () => {
  assert.deepEqual(normalizeNavigationOrder(["/history", "/unknown", "/units"]), [
    "/history",
    "/units",
    "/",
    "/employees",
    "/quick-calc",
    "/entry",
    "/result-confirmation",
    "/policy",
    "/maintenance",
  ]);
});

test("内容缩放比例会按正文尺寸约束在 0.75 到 1.15 之间", () => {
  assert.equal(
    clampWorkspaceContentScale({
      width: 540,
      height: 360,
      defaultWidth: 720,
      defaultHeight: 480,
    }),
    0.75,
  );
  assert.equal(
    clampWorkspaceContentScale({
      width: 900,
      height: 640,
      defaultWidth: 720,
      defaultHeight: 480,
    }),
    1.15,
  );
  assert.equal(
    clampWorkspaceContentScale({
      width: 810,
      height: 540,
      defaultWidth: 720,
      defaultHeight: 480,
    }),
    1.125,
  );
});
