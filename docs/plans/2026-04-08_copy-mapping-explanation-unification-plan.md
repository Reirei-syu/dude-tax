# Copy Mapping & Explanation Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一结果页、历史查询页和 API 导出链路里的方案标签、结算方向标签、预扣模式标签与结果解释逻辑，消除重复维护点而不改变现有业务语义。

**Architecture:** 共享展示映射提升到 `packages/core` 的 display-safe 常量与 helper；前端和 API 都消费同一份标签/说明构造能力。页面本身不再维护局部 `schemeLabelMap`、`settlementDirectionLabelMap` 等重复常量，只负责展示。

**Tech Stack:** TypeScript + React + Node API + `@dude-tax/core`

---

## 1. 背景

- 经过上一轮页面拆分，重复映射已经更容易看清：
  - [annual-results/constants.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-results/constants.ts)
  - [history-query/constants.ts](/D:/coding/dude-tax/apps/desktop/src/pages/history-query/constants.ts)
  - [history-result-recalculation.ts](/D:/coding/dude-tax/apps/api/src/domain/history-result-recalculation.ts)
  - [annual-tax-service.ts](/D:/coding/dude-tax/apps/api/src/services/annual-tax-service.ts)
- 目前至少有以下重复点：
  - `schemeLabelMap`
  - `settlementDirectionLabelMap`
  - `annualTaxWithholdingModeLabelMap`
  - 结果解释与差异解释中的展示文案
- 如果继续在多个页面和 API 层各自维护，后续只会越改越散。

## 2. 目标

- 将方案标签、结算方向标签、预扣模式标签统一到共享层。
- 将“历史结果差异解释”与“年度结果导出展示标签”尽量复用同一套映射。
- 页面与 API 不再各自维护重复标签常量。
- 保持现有接口字段和值不变，仅统一展示标签和解释 helper 来源。

## 3. 设计方案

- 在 `packages/core` 新增展示常量模块，例如：
  - `packages/core/src/display-mappings.ts`
- 输出统一常量：
  - `taxCalculationSchemeLabelMap`
  - `taxSettlementDirectionLabelMap`
  - `annualTaxWithholdingModeLabelMap`
  - 如需要：`historyResultStatusLabelMap`
- API 与前端统一从 `@dude-tax/core` 引入展示映射，不再在各自目录下重复定义。
- 保留现有页面级 explanation helper：
  - [annual-tax-explanation.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-tax-explanation.ts)
  - [annual-tax-rule-source-summary.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-tax-rule-source-summary.ts)
  - [annual-tax-withholding-summary.ts](/D:/coding/dude-tax/apps/desktop/src/pages/annual-tax-withholding-summary.ts)
- 但这些 helper 内若有标签映射，统一改为引用共享 display mapping。
- API 域层 [history-result-recalculation.ts](/D:/coding/dude-tax/apps/api/src/domain/history-result-recalculation.ts) 与服务层 [annual-tax-service.ts](/D:/coding/dude-tax/apps/api/src/services/annual-tax-service.ts) 也切到同一映射来源。

## 4. 涉及模块

- `packages/core/src/index.ts`
- `packages/core/src/display-mappings.ts`（新增）
- `apps/desktop/src/pages/annual-results/constants.ts`
- `apps/desktop/src/pages/history-query/constants.ts`
- `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
- `apps/desktop/src/pages/annual-tax-explanation.ts`
- `apps/api/src/domain/history-result-recalculation.ts`
- `apps/api/src/services/annual-tax-service.ts`

## 5. 数据结构变更

- 无数据库结构变更。
- 无 API 字段变更。

## 6. 接口变更

- 无接口变更。
- 仅统一接口返回中依赖的标签构造来源。

## 7. 风险评估

- 中风险：会改动多处展示文案来源，如果标签映射遗漏，前端和 API 展示可能出现空值或编译错误。
- 若在本轮顺手把 explanation helper 逻辑本身重写，会超出“统一来源”的目标，扩大范围。
- `historyResultStatusLabelMap` 是否提升到 core 需要谨慎；如果它只服务页面筛选，可保留在页面域。

## 8. 回退方案

- 先新增共享映射，再逐步替换调用点。
- 若某个调用点切换后出错，可单独回退该文件到局部映射实现。
- 不删除 explanation helper 文件，仅替换其标签来源，保证回退面最小。

## 9. 任务拆解

### Task 1: Shared Display Mappings

**Files:**

- Create: `packages/core/src/display-mappings.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: 新增共享标签映射**

- `taxCalculationSchemeLabelMap`
- `taxSettlementDirectionLabelMap`
- `annualTaxWithholdingModeLabelMap`

**Step 2: 跑类型检查**

Run: `npm run typecheck`
Expected: PASS

### Task 2: Frontend Mapping Migration

**Files:**

- Modify: `apps/desktop/src/pages/annual-results/constants.ts`
- Modify: `apps/desktop/src/pages/history-query/constants.ts`
- Modify: `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
- Modify: `apps/desktop/src/pages/annual-tax-explanation.ts`

**Step 1: 页面常量改为复用 core 映射**

- 删除重复局部映射
- 保留页面局部格式化函数与仅页面专用状态标签

**Step 2: 跑类型检查**

Run: `npm run typecheck`
Expected: PASS

### Task 3: API Mapping Migration

**Files:**

- Modify: `apps/api/src/domain/history-result-recalculation.ts`
- Modify: `apps/api/src/services/annual-tax-service.ts`

**Step 1: API 导出与差异解释改为复用 core 映射**

- 去掉局部 `schemeLabelMap`
- 去掉局部 `settlementDirectionLabelMap`
- 去掉局部 `annualTaxWithholdingModeLabelMap`

**Step 2: 跑 API 测试**

Run: `npm run test --workspace @dude-tax/api`
Expected: PASS

### Task 4: Final Verification

**Files:**

- Modify: `apps/desktop/src/pages/annual-results/**/*`
- Modify: `apps/desktop/src/pages/history-query/**/*`
- Modify: `apps/api/src/**/*`

**Step 1: 跑完整验证**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run test --workspace @dude-tax/api`
Expected: PASS

**Step 2: 仅在必要时补最小测试**

- 如果展示 helper 行为发生实际变化，再为 helper 补测试
