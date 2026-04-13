import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "AppLayout.tsx"),
  "utf8",
);
const workspaceLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "WorkspaceLayout.tsx"),
  "utf8",
);
const stylesSource = fs.readFileSync(
  path.join(process.cwd(), "src", "styles.css"),
  "utf8",
);
const useWorkspaceLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "src", "hooks", "useWorkspaceLayout.ts"),
  "utf8",
);
const homePageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "HomePage.tsx"),
  "utf8",
);
const unitManagementPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "UnitManagementPage.tsx"),
  "utf8",
);
const monthRecordEntryPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "MonthRecordEntryPage.tsx"),
  "utf8",
);
const yearRecordWorkspaceDialogSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "YearRecordWorkspaceDialog.tsx"),
  "utf8",
);
const annualTaxResultDialogSource = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "AnnualTaxResultDialog.tsx"),
  "utf8",
);

test("AppLayout 提供导航抽屉开关且顶部状态卡不参与可布局项", () => {
  assert.equal(appLayoutSource.includes("sidebar-toggle"), true);
  assert.equal(appLayoutSource.includes("uiSidebarCollapsed"), true);
  assert.equal(appLayoutSource.includes("navigationOrder"), true);
  assert.equal(appLayoutSource.includes("getNavigationOrderPreference"), true);
  assert.equal(appLayoutSource.includes("isNavSortMode"), true);
  assert.equal(appLayoutSource.includes("draggingNavPath"), false);
  assert.equal(appLayoutSource.includes("suppressedNavClickPath"), false);
  assert.equal(appLayoutSource.includes("moveNavItemByStep"), true);
  assert.equal(appLayoutSource.includes("canMoveNavItem"), true);
  assert.equal(appLayoutSource.includes("上移"), true);
  assert.equal(appLayoutSource.includes("下移"), true);
  assert.equal(appLayoutSource.includes("SortModeIcon"), false);
  assert.equal(appLayoutSource.includes('启用导航排序↑↓'), true);
  assert.equal(appLayoutSource.includes('aria-label={isNavSortMode ? "完成导航排序" : "启用导航排序"}'), true);
  assert.equal(appLayoutSource.includes("context-bar"), true);
  assert.equal(appLayoutSource.includes("context-bar-item"), false);
});

test("工作区工具条同时提供恢复默认布局和自动排列按钮", () => {
  assert.equal(workspaceLayoutSource.includes("自动排列"), true);
  assert.equal(workspaceLayoutSource.includes("恢复默认布局"), true);
});

test("工作区布局控制器使用稳定回调，避免重复注册 canvas actions", () => {
  assert.equal(useWorkspaceLayoutSource.includes("useCallback"), true);
  assert.equal(useWorkspaceLayoutSource.includes("const saveCanvasLayouts = useCallback"), true);
  assert.equal(useWorkspaceLayoutSource.includes("const resetLayout = useCallback"), true);
  assert.equal(workspaceLayoutSource.includes("setCanvasActions((currentActions) =>"), true);
  assert.equal(workspaceLayoutSource.includes("const storedCanvasCards = useMemo("), true);
  assert.equal(workspaceLayoutSource.includes("const staleStoredCards = storedCanvasCards.filter("), true);
  assert.equal(workspaceLayoutSource.includes("void saveCanvasLayouts(canvasId, validStoredCanvasCards);"), true);
});

test("导航排序样式保持原按钮宽度，并将箭头控件悬浮到导航右侧", () => {
  assert.equal(stylesSource.includes(".nav-item {\n  width: 100%;"), true);
  assert.equal(stylesSource.includes(".sort-mode-button {\n  width: 100%;"), true);
  assert.equal(stylesSource.includes(".nav-item-sort-controls {\n  position: absolute;"), true);
  assert.equal(stylesSource.includes('left: calc(100% + 10px);'), true);
  assert.equal(stylesSource.includes(".nav-sort-arrow-button {\n  width: 24px;"), true);
  assert.equal(stylesSource.includes("height: 20px;"), true);
  assert.equal(stylesSource.includes("filter: blur(6px);"), true);
});

test("首页、单位管理、月度数据录入接入页面级布局 scope 与稳定 cardId", () => {
  assert.equal(homePageSource.includes('scope="page:home"'), true);
  assert.equal(homePageSource.includes('cardId="home-overview"'), true);
  assert.equal(unitManagementPageSource.includes('scope="page:units"'), true);
  assert.equal(unitManagementPageSource.includes('cardId="units-create"'), true);
  assert.equal(monthRecordEntryPageSource.includes('scope="page:entry"'), true);
  assert.equal(monthRecordEntryPageSource.includes('cardId="entry-overview"'), true);
});

test("主要弹窗切换到统一浮动窗口壳", () => {
  assert.equal(yearRecordWorkspaceDialogSource.includes("FloatingWorkspaceDialog"), true);
  assert.equal(
    yearRecordWorkspaceDialogSource.includes('scope="dialog:year-record-workspace"'),
    true,
  );
  assert.equal(annualTaxResultDialogSource.includes("FloatingWorkspaceDialog"), true);
  assert.equal(
    annualTaxResultDialogSource.includes('scope="dialog:annual-tax-result"'),
    true,
  );
});
