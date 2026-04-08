# SQLite CHECK 约束补强方案

## 1. 背景

- 当前 [database.ts](/D:/coding/dude-tax/apps/api/src/db/database.ts) 中大多数业务表只依赖应用层 `zod` 校验，没有数据库级 `CHECK` 约束。
- 这在单机离线场景下风险较高：一旦导入链路、调试脚本、旧库兼容迁移或未来新接口绕过应用层，SQLite 无法成为最后防线。
- 当前下一步任务是为关键字段补数据库约束，但 SQLite 对既有列追加 `CHECK` 支持有限，不能简单用 `ALTER TABLE ... ADD CONSTRAINT` 解决。

## 2. 目标

- 为关键业务表补充数据库级 `CHECK` 约束。
- 保证约束与当前真实业务枚举和值域一致，不照搬旧方案中的过期字段语义。
- 提供兼容旧库的迁移策略、失败回退策略和验证办法。

## 3. 设计方案

- 采用“影子表重建迁移”而不是对既有表直接追加约束。
- 对每张需要补约束的表执行：
  - 创建 `__next` 临时表，带完整 `CHECK`
  - 将旧表数据复制到临时表
  - 复制成功后删除旧表并重命名
  - 恢复索引
- 迁移过程放在 [database.ts](/D:/coding/dude-tax/apps/api/src/db/database.ts) 启动初始化链路中，使用事务包裹单表迁移。
- 迁移前先执行“旧数据预检查”：
  - 统计不合法行数
  - 若存在脏数据，拒绝自动迁移并给出明确错误，避免静默截断或隐式修正
- 约束范围按当前真实模型定义：
  - `employee_month_records`
    - `CHECK(tax_month BETWEEN 1 AND 12)`
    - `CHECK(tax_year >= 2000)`
    - `CHECK(status IN ('incomplete','completed'))`
    - 所有金额字段 `>= 0`
  - `annual_calculation_runs`
    - `CHECK(tax_year >= 2000)`
    - `CHECK(last_status IN ('not_started','draft','ready'))`
  - `annual_tax_results`
    - `CHECK(tax_year >= 2000)`
    - `CHECK(selected_scheme IN ('separate_bonus','combined_bonus'))`
    - `CHECK(selected_tax_amount >= 0)`
  - `annual_tax_result_versions`
    - `CHECK(tax_year >= 2000)`
    - `CHECK(version_sequence >= 1)`
    - `CHECK(selected_scheme IN ('separate_bonus','combined_bonus'))`
    - `CHECK(selected_tax_amount >= 0)`
- 关于“税率表范围约束”：
  - 当前税率版本数据存放在 `tax_policy_versions.settings_json`
  - 这不是列式存储，SQLite 无法对 JSON 内部税率范围做可靠 `CHECK`
  - 本轮保持应用层 `zod + normalizeTaxPolicySettings` 校验，不强行做伪约束
  - 在方案中明确标记为“当前结构下不适合做数据库级 `CHECK`”

## 4. 涉及模块

- `apps/api/src/db/database.ts`
- `apps/api/src/month-records.test.ts`
- `apps/api/src/annual-results.test.ts`
- 如需新增专门迁移验证：`apps/api/src/db/*.test.ts`

## 5. 数据结构变更

- 不新增业务字段。
- 会重建以下表结构：
  - `employee_month_records`
  - `annual_calculation_runs`
  - `annual_tax_results`
  - `annual_tax_result_versions`
- 索引需要在重建后重新创建。

## 6. 接口变更

- 不新增对外 API。
- 迁移后，非法数据写入会在数据库层失败，接口可能从原来的 400/422 演变为需要捕获 SQLite 错误并转成明确用户提示。

## 7. 风险评估

- 高风险：属于数据库结构调整，且在应用启动时自动执行。
- SQLite 重建表若处理不严谨，容易造成索引丢失、事务中断或旧库无法启动。
- 若旧数据库已有脏数据，自动迁移可能失败；必须优先做预检查并给出明确失败信息。
- 旧方案里提到的 `status IN ('normal','deleted','draft')` 与当前真实模型不符，不能照抄，否则会直接破坏现有功能。

## 8. 回退方案

- 迁移按单表事务执行，单表失败则整表不替换，保留原表。
- 若某张表迁移逻辑存在问题，可回退：
  - 删除该次新增的影子表迁移代码
  - 恢复原始 `CREATE TABLE IF NOT EXISTS` 定义
- 对已启动失败的库，因旧表未被替换，回退代码后可重新启动。

## 9. 任务拆解

- [ ] 设计旧数据预检查逻辑，明确哪些约束会阻止自动迁移
- [ ] 为 `employee_month_records` 实现影子表迁移与 `CHECK` 约束
- [ ] 为 `annual_calculation_runs`、`annual_tax_results`、`annual_tax_result_versions` 实现影子表迁移与 `CHECK` 约束
- [ ] 在数据库初始化链路中补充约束迁移执行顺序与事务边界
- [ ] 补测试：非法月份 / 非法状态 / 负金额写入失败，合法数据不受影响
- [ ] 跑 API 测试与类型检查，确认迁移未破坏现有启动与主流程
