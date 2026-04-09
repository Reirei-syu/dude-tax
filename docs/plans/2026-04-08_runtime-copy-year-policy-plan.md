# 系统维护、年份体系与月度录入联动优化方案

## 1. 背景

当前项目存在三类问题：

1. 多个运行时页面与接口文案存在乱码。
2. 年份仍按固定候选列表工作，无法体现“单位起始年份 + 后续按需新增”的业务规则。
3. 系统维护中的说明能力只有输入口，没有单独的政策展示出口，也无法维护标题 / 正文 / 插图三段式内容。

## 2. 目标

- 清理运行时用户可见乱码。
- 建立单位级年份集合，支持新增、删除、切换。
- 给员工补充状态语义，并联动月度录入可见范围。
- 重构月度录入页的月份切换区和当前月摘要区。
- 让批量导入模板支持真实文件下载和简体中文模板头。
- 新增“当前政策”模块，并让系统维护成为其唯一维护入口。

## 3. 设计方案

- 在数据库中新增 `unit_years` 表，替代固定年份候选列表。
- 新建共享员工状态 helper，前后端统一按 `leaveDate + 当前年份 + 月份` 推导状态。
- 月度录入页按月份过滤员工，仅保留“在职 / 本月离职本月”员工。
- 现有 `maintenance_notes` 升级为结构化政策内容存储，保存 `policyTitle / policyBody / policyIllustrationDataUrl`。
- 当前政策页面直接读取当前生效税率版本对应的结构化政策内容与税率表。
- 批量导入模板改为后端输出中文 CSV 模板，前端使用文件保存能力下载。

## 4. 涉及模块

- `apps/api`
- `apps/desktop`
- `packages/core`
- `packages/config`

## 5. 数据结构变更

- 新增表：`unit_years`
- `Unit` 新增：`availableTaxYears`
- `CreateUnitPayload` 新增：`startYear`
- `TaxPolicyResponse / TaxPolicyUpdatePayload` 新增：
  - `policyTitle`
  - `policyBody`
  - `policyIllustrationDataUrl`

## 6. 接口变更

- `POST /api/units` 需要 `startYear`
- 新增：
  - `POST /api/units/:unitId/years`
  - `DELETE /api/units/:unitId/years/:taxYear`
- `GET /api/tax-policy` 和 `PUT /api/tax-policy` 返回 / 接收结构化政策内容

## 7. 风险评估

- 年份体系从静态列表切到持久化集合，会影响上下文切换、历史筛选和新建单位流程。
- 月度录入页整页重构，存在样式和交互回归风险。
- 政策说明从纯文本升级为结构化内容，需要保证旧数据兼容可读。

## 8. 回退方案

- 数据库层：保留 `units` 主表与现有税率版本表不变，`unit_years` 为增量表，可独立回滚。
- UI 层：页面级重写均保持原路由和原接口名，出现问题可按文件级回退。
- 政策说明层：结构化内容仍存储在原 `maintenance_notes` 字段，必要时可退回仅用 `policyBody` 解释。

## 9. 任务拆解

1. 清理运行时乱码并补回归测试。
2. 新增 `unit_years` 表与单位年份仓储 / 路由能力。
3. 改造上下文与顶部年份选择器，按单位可用年份工作。
4. 新增共享员工状态 helper，并改造员工页与月度录入页。
5. 重构月度录入页布局与样式。
6. 改造批量导入模板下载与中文表头解析。
7. 升级系统维护为结构化政策内容维护。
8. 新增“当前政策”页面并接入导航。
9. 补测试、类型检查、构建与文档同步。
