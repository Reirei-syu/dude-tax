# 快速计算模块年度化速算优化方案

## 1. 背景

快速计算仍带有按月份预览的交互痕迹，不符合“站在全年视角进行速算”的定位。

## 2. 目标

- 去掉全年月份选择按钮和对应摘要卡
- 工作台中隐藏预扣税额输入
- 结果区改为按月预扣轨迹表

## 3. 设计方案

- `core` 预扣轨迹项补充适用税率和累计已预扣额字段
- `quick-calculate` 接口直接返回逐月预扣轨迹
- `QuickCalculatePage` 切换为全年视角入口，只保留工作台入口和执行按钮
- 共享工作台按配置隐藏 `withheldTax`

## 4. 涉及模块

- `packages/core`
- `apps/api`
- `apps/desktop`

## 5. 数据结构变更

- `AnnualTaxWithholdingTraceItem`
  - `appliedRate`
  - `cumulativeActualWithheldTaxBeforeCurrentMonth`
- `AnnualTaxCalculation`
  - `withholdingTraceItems`

## 6. 接口变更

- 不新增路由
- `POST /api/quick-calculate` 返回值增加逐月预扣轨迹

## 7. 风险评估

- 低到中风险
- 主要风险是 quick-calc 结果展示与旧测试 fixture 不兼容

## 8. 回退方案

- 不变更数据库
- 只改 quick-calc 页面与轨迹返回字段
- 如需回退，可直接回退本轮提交，不影响其他主模块

## 9. 任务拆解

- [x] core 逐月预扣轨迹字段扩展
- [x] quick-calculate API 测试补充
- [x] 快速计算页改为全年视角
- [x] 共享工作台隐藏列配置
- [x] 全量测试、typecheck、build 通过
