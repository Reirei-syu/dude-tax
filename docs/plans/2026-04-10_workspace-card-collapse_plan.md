# 工作区卡片统一折叠支持方案

## 1. 背景

- 当前桌面端只有部分工作区卡片支持折叠：系统维护页、月度数据录入页的局部卡片，以及批量导入工作区。
- 其余主界面顶层卡片仍为静态展开状态，长页面首屏信息密度偏高，缺少统一的展开/收起交互。
- 需求要求为工作区卡片统一补充折叠能力，同时明确已有折叠配置不做变动。

## 2. 目标

- 为当前路由实际可见的桌面端顶层工作区卡片补统一折叠能力。
- 保持现有折叠实现原样，不修改系统维护页、月度数据录入页既有折叠状态与交互。
- 不引入新依赖，不改 API、数据库和核心业务逻辑。

## 3. 设计方案

- 新增共享组件 `apps/desktop/src/components/CollapsibleSectionCard.tsx`：
  - 承载卡片标题、描述、头部扩展区、折叠按钮。
  - 使用 `aria-controls` / `aria-expanded` 提供可访问折叠状态。
  - 内容区统一使用 `.collapsible-card-body` + `hidden` 控制视觉收起。
  - 折叠状态仅保存在页面内存中，不做持久化。
- 复用现有 `styles.css` 中的 `.collapsible-card-body[hidden]` 隐藏机制，仅新增头部操作区样式。
- 新接入默认策略：
  - 主操作、筛选、录入类卡片默认展开。
  - 结果、参考、明细类卡片按页面规则默认折叠或展开。
  - 已存在折叠逻辑的卡片不接入新组件，保持原实现。

## 4. 涉及模块

- `apps/desktop/src/components/CollapsibleSectionCard.tsx`
- `apps/desktop/src/pages/HomePage.tsx`
- `apps/desktop/src/pages/UnitManagementPage.tsx`
- `apps/desktop/src/pages/EmployeeManagementPage.tsx`
- `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
- `apps/desktop/src/pages/QuickCalculatePage.tsx`
- `apps/desktop/src/pages/ResultConfirmationPage.tsx`
- `apps/desktop/src/pages/CalculationCenterPage.tsx`
- `apps/desktop/src/pages/CurrentPolicyPage.tsx`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`
- `apps/desktop/src/styles.css`

## 5. 数据结构变更

- 无。

## 6. 接口变更

- 无对外 API 变更。
- 新增内部组件接口：
  - `title: string`
  - `description?: string`
  - `defaultCollapsed?: boolean`
  - `headerExtras?: ReactNode`
  - `className?: string`
  - `children?: ReactNode`

## 7. 风险评估

- 中风险。
- 主要风险：
  - 误改已有折叠逻辑，导致系统维护页或月度数据录入页回归。
  - `hidden` 与业务样式冲突，出现状态已收起但视觉仍展开。
  - 源码断言测试与 JSX 格式化不一致，导致测试误报。

## 8. 回退方案

- 共享组件接入仅限 `apps/desktop` 页面层，可按文件逐个回退。
- 若某页面折叠交互异常，可撤回该页面对 `CollapsibleSectionCard` 的接入，保留其它页面。
- 若共享样式影响范围超预期，可回退 `styles.css` 中新增的头部操作区样式。

## 9. 任务拆解

- 新增共享折叠卡片组件，复用现有 `hidden` 显示/隐藏机制。
- 将首页、单位管理、政策参考、历史查询、计算中心、快速计算、结果确认的顶层卡片接入共享组件。
- 为员工信息页、月度数据录入页仅补未折叠的顶层主卡片，保留已有折叠卡片原逻辑。
- 补充桌面端源码断言测试，覆盖默认折叠矩阵与既有折叠行为回归。
- 执行 `test`、`typecheck`、`build` 验证，并同步 `tasks.md`、`PROGRESS.md`、`latest_context.md`。
