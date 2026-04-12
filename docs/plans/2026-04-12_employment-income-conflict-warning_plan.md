# 员工入离职月份收入强提示实施方案

## 1. 背景

- 当前年度工作台允许在员工入职前月份、离职后月份直接录入收入，缺少明确风险提示。
- 该行为容易导致工资薪金记录与员工在职状态不一致，需要补充前端强提示和后端硬阻断。

## 2. 目标

- 在年度工作台保存与复制场景下，对入职前 / 离职后收入录入进行三选强提示。
- 后端保存接口对未确认的异常月份直接阻断，确保桌面前端之外的入口也不能绕过。

## 3. 设计方案

- `packages/core` 增加就业月份收入冲突判定与冲突月份聚合能力。
- `apps/api` 在年度工作台保存接口与单月保存接口统一返回 409 结构化冲突信息，并支持显式确认月份放行。
- `apps/desktop` 增加自定义三选弹层和本地预检 helper：
  - 继续保存/复制异常月份
  - 跳过异常月份，仅处理合法月份
  - 取消

## 4. 涉及模块

- `packages/core`
- `apps/api`
- `apps/desktop`
- `docs`

## 5. 数据结构变更

- `EmployeeYearRecordWorkspace` 新增 `hireDate`、`leaveDate`
- `UpsertEmployeeMonthRecordPayload` 新增可选 `acknowledgedEmploymentConflictMonths`
- `BatchUpsertEmployeeYearRecordsPayload` 新增可选 `acknowledgedEmploymentConflictMonths`

## 6. 接口变更

- 年度工作台保存接口支持显式确认异常月份
- 单月保存接口支持显式确认异常月份
- 409 冲突响应新增：
  - `conflictType`
  - `conflictMonths`
  - `beforeHireMonths`
  - `afterLeaveMonths`
  - `hireDate`
  - `leaveDate`

## 7. 风险评估

- 前端本地预检与后端硬阻断必须共用同一判定口径，否则会产生前后端分叉。
- 仅对收入字段做冲突提示，预扣税额和扣除项不纳入本轮规则。

## 8. 回退方案

- 回退前端弹层与 helper
- 移除保存接口的异常月份确认字段与 409 冲突分支
- 恢复到“仅锁定确认月份”的既有保存逻辑

## 9. 任务拆解

- 新增 core 判定函数与测试
- 新增 API 冲突错误对象、schema 扩展与测试
- 新增桌面 helper、弹层组件、页面流程与测试
- 同步更新规格、进度、任务和上下文文档

## 10. 测试方案

- Core：入职前、离职后、当月允许、仅扣除项不触发
- API：工作台保存阻断/确认放行，单月保存阻断/确认放行
- Desktop：弹层接入、三选文案、异常月份过滤与保存/复制分支
