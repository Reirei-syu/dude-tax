import assert from "node:assert/strict";
import test from "node:test";
import type {
  FloatingDialogLayout,
  WorkspaceCardLayout,
  WorkspaceLayoutState,
} from "@dude-tax/core";
import {
  autoArrangeWorkspaceCards,
  bringCardToFront,
  clampFloatingDialogLayout,
  clampWorkspaceCardLayout,
  clampWorkspaceContentScale,
  mergeLayoutState,
  normalizeNavigationOrder,
  pinCardToHorizontalEdge,
} from "./workspace-layout";

test("合并默认布局时保留已保存卡片位置并补齐缺失卡片", () => {
  const defaults: WorkspaceCardLayout[] = [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 10, z: 0 },
    { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 10, z: 1 },
  ];
  const storedState: WorkspaceLayoutState = {
    scope: "page:home",
    cards: [{ cardId: "overview", canvasId: "root", x: 2, y: 3, w: 7, h: 12, z: 3 }],
  };

  const merged = mergeLayoutState("page:home", defaults, storedState);

  assert.deepEqual(merged, {
    scope: "page:home",
    cards: [
      { cardId: "overview", canvasId: "root", x: 2, y: 3, w: 7, h: 12, z: 3 },
      { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 10, z: 1 },
    ],
  });
});

test("布局 clamp 会统一 round 到 0.1 格并保留 z 值", () => {
  const clamped = clampWorkspaceCardLayout({
    cardId: "overview",
    canvasId: "root",
    x: 1.26,
    y: 2.34,
    w: 6.44,
    h: 8.06,
    z: 3,
  });

  assert.deepEqual(clamped, {
    cardId: "overview",
    canvasId: "root",
    x: 1.3,
    y: 2.3,
    w: 6.4,
    h: 8.1,
    z: 3,
  });
});

test("顶置只提升当前 canvas 内的 z 层级", () => {
  const nextCards = bringCardToFront([
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 8, z: 0 },
    { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 8, z: 2 },
    { cardId: "dialog-card", canvasId: "dialog", x: 0, y: 0, w: 4, h: 4, z: 8 },
  ], "overview", "root");

  assert.deepEqual(nextCards, [
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 6, h: 8, z: 3 },
    { cardId: "policy", canvasId: "root", x: 6, y: 0, w: 6, h: 8, z: 2 },
    { cardId: "dialog-card", canvasId: "dialog", x: 0, y: 0, w: 4, h: 4, z: 8 },
  ]);
});

test("靠左和靠右只调整 x，不改变尺寸与层级", () => {
  const leftPinned = pinCardToHorizontalEdge(
    { cardId: "overview", canvasId: "root", x: 5.7, y: 1.2, w: 3.4, h: 8, z: 4 },
    "left",
  );
  const rightPinned = pinCardToHorizontalEdge(
    { cardId: "overview", canvasId: "root", x: 5.7, y: 1.2, w: 3.4, h: 8, z: 4 },
    "right",
  );

  assert.deepEqual(leftPinned, {
    cardId: "overview",
    canvasId: "root",
    x: 0,
    y: 1.2,
    w: 3.4,
    h: 8,
    z: 4,
  });
  assert.deepEqual(rightPinned, {
    cardId: "overview",
    canvasId: "root",
    x: 8.6,
    y: 1.2,
    w: 3.4,
    h: 8,
    z: 4,
  });
});

test("自动排列会把初始重叠卡片整理为不重叠且同一行高度统一", () => {
  const arranged = autoArrangeWorkspaceCards([
    { cardId: "overview", canvasId: "root", x: 0, y: 3.2, w: 4.2, h: 8, z: 3 },
    { cardId: "policy", canvasId: "root", x: 1.5, y: 3.1, w: 4.2, h: 10, z: 1 },
    { cardId: "history", canvasId: "root", x: 2.3, y: 3.4, w: 4.2, h: 9, z: 7 },
  ]);

  assert.deepEqual(arranged, [
    { cardId: "policy", canvasId: "root", x: 0, y: 0, w: 4, h: 10, z: 1 },
    { cardId: "overview", canvasId: "root", x: 4, y: 0, w: 4, h: 10, z: 3 },
    { cardId: "history", canvasId: "root", x: 8, y: 0, w: 4, h: 10, z: 7 },
  ]);
});

test("自动排列在超出 10% 宽度微调上限时会提前换行", () => {
  const arranged = autoArrangeWorkspaceCards([
    { cardId: "overview", canvasId: "root", x: 0, y: 0, w: 4.5, h: 8, z: 0 },
    { cardId: "policy", canvasId: "root", x: 0.5, y: 0.1, w: 4.5, h: 9, z: 1 },
    { cardId: "history", canvasId: "root", x: 1, y: 0.2, w: 4.5, h: 7, z: 2 },
  ]);

  assert.equal(arranged[0]?.y, 0);
  assert.equal(arranged[1]?.y, 0);
  assert.equal(arranged[2]?.y > 0, true);
  assert.equal((arranged[0]?.w ?? 0) <= 5, true);
  assert.equal((arranged[1]?.w ?? 0) <= 5, true);
  assert.equal((arranged[2]?.w ?? 0) <= 5, true);
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
