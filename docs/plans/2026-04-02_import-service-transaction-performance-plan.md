# 导入服务事务与性能修复方案

## 1. 背景

- 当前 [import-service.ts](/D:/coding/dude-tax/apps/api/src/services/import-service.ts) 将 `preview` 与 `commit` 混在同一服务里，但 `commit` 没有事务边界。
- 现有 `commit` 会先调用一次 `preview`，结束后再次按行解析 CSV 并逐行执行写入；提交完成后还会再次调用 `preview` 保存摘要，存在重复解析与重复查询。
- 预览与提交阶段都在循环中反复调用 `employeeRepository.listByUnitId(...)`、`monthRecordRepository.listByEmployeeAndYear(...)`，存在明显 N+1 查询。
- 当前提交语义是“允许部分成功”，但这个策略没有被明确固化，也没有事务外显说明；在数据库约束补强后，失败路径会更容易暴露。

## 2. 目标

- 为导入提交建立明确、稳定、可验证的执行语义。
- 消除 `commit` 过程中的 N+1 查询与重复解析。
- 为提交写入增加事务边界，保证结果可预测、可回退。
- 保持现有 API 形态尽量不变，避免扩大前后端改动范围。

## 3. 设计方案

- 策略选择：本轮采用 **A. 全成功才提交**。
  - 理由：
    - 当前产品是离线单机财税工具，导入后出现“部分成功、部分失败”会让用户难以判断数据库实际状态。
    - 已有 `preview` 链路，完全可以先把所有错误、冲突在预览阶段暴露出来，再决定是否提交。
    - 数据库约束已补齐后，原子提交更符合“安全性与可回退性优先”。
- 服务拆分建议：
  - 保留 `importService.preview(...)`
  - 将 `commit(...)` 改为：
    - 一次解析 CSV
    - 一次性预加载所需上下文
    - 先构建“可执行导入计划”
    - 若计划中存在错误/冲突且策略不允许，则直接返回，不写库
    - 进入单个事务统一写入
- 预加载策略：
  - 对 `employee` 导入：
    - 预加载 `employeeRepository.listByUnitId(unitId)` 一次
    - 构建 `employeeCode -> employee`、`idNumber -> employee` 索引
  - 对 `month_record` 导入：
    - 预加载当前单位员工列表一次
    - 按涉及到的 `taxYear` 分组预加载月度记录，而不是每行 `listByEmployeeAndYear(...)`
    - 构建 `employeeCode + taxYear + taxMonth` 的冲突索引
- 摘要保存策略：
  - `commit` 成功后不再重新调用完整 `preview`
  - 改为基于当前执行计划直接写入 `import_preview_summaries` 或清理摘要
- 源码引用收口：
  - [import-service.ts](/D:/coding/dude-tax/apps/api/src/services/import-service.ts) 当前仍直接引用 `packages/core/src/index.js`
  - 本轮一并改回 `@dude-tax/core`

## 4. 涉及模块

- `apps/api/src/services/import-service.ts`
- `apps/api/src/repositories/import-summary-repository.ts`
- `apps/api/src/repositories/employee-repository.ts`
- `apps/api/src/repositories/month-record-repository.ts`
- `apps/api/src/import.test.ts`

## 5. 数据结构变更

- 不新增数据库字段。
- 不改表结构。
- 如需要，可调整 `import_preview_summaries` 在提交后的更新策略，但不改 schema。

## 6. 接口变更

- 尽量不改现有 `/api/import/preview` 与 `/api/import/commit` 的请求/响应结构。
- 若采用“全成功才提交”，则：
  - `commit` 在发现冲突或错误时返回 `successCount = 0`
  - `failureCount` 和 `failures` 明确反映阻止提交的原因
- 不新增前端接口。

## 7. 风险评估

- 中风险：会改变导入提交的实际行为语义，从“允许部分成功”收紧为“全成功才提交”。
- 若前端或用户已经依赖“部分成功”行为，切换后需要在返回结果里保证解释足够清晰。
- 事务实现若和现有仓储副作用冲突，可能导致提交时抛出新的数据库错误。

## 8. 回退方案

- 若新事务方案引入不可接受行为变化，可回退：
  - `import-service.ts`
  - `import.test.ts`
- 回退后恢复旧的“逐行提交 + 部分成功”语义，但需保留本次策略决策记录。

## 9. 任务拆解

- [ ] 盘点 `preview` / `commit` 的重复解析与 N+1 查询点，抽出共享解析结果结构
- [ ] 为员工导入建立单位级员工索引，移除循环内 `listByUnitId(...)`
- [ ] 为月度导入建立员工索引与按年度分组的月度记录索引，移除循环内 `listByEmployeeAndYear(...)`
- [ ] 将 `commit` 改为“预构建执行计划 + 单事务提交”
- [ ] 收紧提交策略为“全成功才提交”，并保持失败报告可读
- [ ] 去掉 `import-service.ts` 对 `packages/core/src` 的源码级引用
- [ ] 补导入回归测试：冲突阻止提交、事务回滚、性能相关重复查询消除后的主路径验证
