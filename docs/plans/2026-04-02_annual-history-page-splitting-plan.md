# Annual Results & History Query Page Splitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 [AnnualResultsPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/AnnualResultsPage.tsx) 和 [HistoryQueryPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/HistoryQueryPage.tsx) 拆成可维护的页面组合层，保留现有功能与行为不变。

**Architecture:** 页面本身只负责组装 section 组件与 hook 返回值；数据获取、状态流转和副作用收口到 page-specific hooks；纯展示和文案映射拆到 components / constants / utils。现有导出、解释、差异对比 helper 继续复用，不重写业务逻辑。

**Tech Stack:** React + TypeScript + Vite + 现有 `apiClient` + 现有页面 helper 模块

---

## 1. 背景

- [AnnualResultsPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/AnnualResultsPage.tsx) 当前约 `948` 行。
- [HistoryQueryPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/HistoryQueryPage.tsx) 当前约 `755` 行。
- 两个页面都已拥有较多辅助模块，但页面文件仍同时承担：
  - 数据加载
  - 副作用协调
  - 导出动作
  - 选中状态管理
  - 文案映射
  - 大量 JSX 展示
- 当前任务目标是可维护性收口，不允许改变现有业务口径、接口语义和用户交互。

## 2. 目标

- 将两个页面主文件压到 `< 300` 行。
- 保持 `UI -> apiClient -> API` 分层不变。
- 不改现有接口协议，不顺手重写既有 helper。
- 为后续 P3 第三项“统一文案映射与结果解释逻辑”预留清晰落点。

## 3. 设计方案

- 为两个页面各自建立目录：
  - `apps/desktop/src/pages/annual-results/`
  - `apps/desktop/src/pages/history-query/`
- 每个目录按以下分层拆分：
  - `hooks/`：数据获取、副作用、页面状态
  - `components/`：纯展示 section
  - `constants.ts`：页面内暂时仍未共享的标签映射
  - `types.ts`：页面内局部视图模型或 props 类型
- 保留现有纯业务 helper 文件不动，例如：
  - [annual-tax-export.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-tax-export.ts)
  - [annual-tax-explanation.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-tax-explanation.ts)
  - [history-query-export.ts](/D:/coding/dude-tax/apps/desktop/src/pages/history-query-export.ts)
  - [history-query-year-summary.ts](/D:/coding/dude-tax/apps/desktop/src/pages/history-query-year-summary.ts)
- 拆分顺序：
  1. 先抽 hook，保持状态和副作用行为不变
  2. 再抽 section 组件，页面仅保留组装
  3. 最后收口页面内常量映射

## 4. 涉及模块

- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`
- 新增：
  - `apps/desktop/src/pages/annual-results/*`
  - `apps/desktop/src/pages/history-query/*`
- 验证：
  - `apps/desktop/src/**/*.test.tsx` 如需新增页面拆分后的 hook / component 测试

## 5. 数据结构变更

- 不涉及数据库结构变更。
- 不涉及 API 请求/响应结构变更。

## 6. 接口变更

- 无接口变更。
- 前端仍复用现有 `apiClient` 方法。

## 7. 风险评估

- 中风险：会同时改动大量前端文件，容易造成状态联动缺失或 props 透传遗漏。
- 如果先拆 JSX 再拆状态，容易把副作用和交互行为打散。
- 若在本轮把文案映射也强行全局化，会和下一项 P3 第三项任务重叠，扩大范围。

## 8. 回退方案

- 按页面分开实施与验证。
- 若某个页面拆分后出现行为回归，仅回退该页面目录与对应主文件。
- 不触碰现有 helper 文件，确保回退面最小。

## 9. 任务拆解

### Task 1: Annual Results Page Skeleton

**Files:**

- Create: `apps/desktop/src/pages/annual-results/constants.ts`
- Create: `apps/desktop/src/pages/annual-results/types.ts`
- Modify: `apps/desktop/src/pages/AnnualResultsPage.tsx`

**Step 1: 提取页面内映射与局部类型**

- 抽出 `schemeLabelMap`
- 抽出 `settlementDirectionLabelMap`
- 抽出局部 section props 类型

**Step 2: 运行类型检查确认无行为变化**

Run: `npm run typecheck`
Expected: PASS

### Task 2: Annual Results Hook

**Files:**

- Create: `apps/desktop/src/pages/annual-results/hooks/useAnnualResultsPage.ts`
- Modify: `apps/desktop/src/pages/AnnualResultsPage.tsx`

**Step 1: 抽出页面数据与副作用**

- 收口：
  - `loadResults`
  - `loadResultVersions`
  - `switchSelectedScheme`
  - 选中员工、版本、导出字段状态

**Step 2: 页面改为只消费 hook 返回值**

Run: `npm run typecheck`
Expected: PASS

### Task 3: Annual Results Sections

**Files:**

- Create: `apps/desktop/src/pages/annual-results/components/ResultsSummarySection.tsx`
- Create: `apps/desktop/src/pages/annual-results/components/ResultsTableSection.tsx`
- Create: `apps/desktop/src/pages/annual-results/components/ResultDetailSection.tsx`
- Create: `apps/desktop/src/pages/annual-results/components/ExportSection.tsx`
- Modify: `apps/desktop/src/pages/AnnualResultsPage.tsx`

**Step 1: 按 section 抽 JSX**

- 页面主文件仅保留：
  - 空状态判断
  - section 组装

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: PASS

### Task 4: History Query Hook

**Files:**

- Create: `apps/desktop/src/pages/history-query/constants.ts`
- Create: `apps/desktop/src/pages/history-query/types.ts`
- Create: `apps/desktop/src/pages/history-query/hooks/useHistoryQueryPage.ts`
- Modify: `apps/desktop/src/pages/HistoryQueryPage.tsx`

**Step 1: 抽出筛选、结果加载、版本历史加载、重算对比加载**

- 收口：
  - `loadEmployees`
  - `loadHistoryResults`
  - `loadVersionHistory`
  - `loadComparison`
  - `filters`
  - `selectedResultId`

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: PASS

### Task 5: History Query Sections

**Files:**

- Create: `apps/desktop/src/pages/history-query/components/HistoryFiltersSection.tsx`
- Create: `apps/desktop/src/pages/history-query/components/HistoryResultsSection.tsx`
- Create: `apps/desktop/src/pages/history-query/components/HistoryDetailSection.tsx`
- Create: `apps/desktop/src/pages/history-query/components/HistoryVersionsSection.tsx`
- Create: `apps/desktop/src/pages/history-query/components/HistoryComparisonSection.tsx`
- Modify: `apps/desktop/src/pages/HistoryQueryPage.tsx`

**Step 1: 拆 JSX section**

- 页面主文件仅保留：
  - hook 调用
  - section 排列

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: PASS

### Task 6: Regression Verification

**Files:**

- Modify: `apps/desktop/src/pages/AnnualResultsPage.tsx`
- Modify: `apps/desktop/src/pages/HistoryQueryPage.tsx`
- Test: `apps/desktop/src/pages/**/*.test.tsx`（仅在确有必要时新增）

**Step 1: 跑前端类型与 API 回归**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run test --workspace @dude-tax/api`
Expected: PASS

**Step 2: 如拆分引入前端行为回归，再补最小测试**

- 只为新增 hook 或复杂 props 组装补测试，不为简单搬运写冗余测试
