# 桌面端全链路 1 小时长稳压测与修复方案

## 1. 背景

- 当前仓库已完成多轮功能闭环，但仍缺少针对“长时间运行 + 数据累积 + 恢复路径”的系统性验证。
- 已通过缩比样本确认两条长稳风险：
  - 同一数据、同一税率、同一结果重复重算时，`annual_tax_result_versions` 线性膨胀。
  - `confirmed-results` 查询在员工规模放大后出现明显退化。
- 当前项目没有现成 Electron E2E 自动化能力，需要用“真实 Electron 壳 + API 驱动压测脚本”的组合完成桌面端全链路验证。

## 2. 目标

- 修复重复重算导致的版本历史无界增长问题。
- 修复 `confirmed-results` 的 N+1 查询退化问题。
- 提供一个可重复执行、结构化输出的桌面端全链路压测 CLI。
- 完成 1 小时长稳压测，并将证据落到 `docs/stress/2026-04-10-desktop-full-chain-soak/`。

## 3. 设计方案

- 版本历史去重：
  - 在 `annual_tax_results` 持久化前，精确比较当前结果与待写入结果的 `policy_signature`、`data_signature`、`selected_scheme`、`selected_tax_amount`、`calculation_snapshot`。
  - 若五项完全一致，只刷新当前结果时间戳，不追加 `annual_tax_result_versions`。
  - 若任一项变化，维持现有“更新当前结果 + 追加版本历史”行为。
- `confirmed-results` 批量化：
  - 一次性加载当前单位当前年度的全部确认月份、全部员工、全部月度记录。
  - 服务层按 `employeeId -> taxMonth` 建立内存索引，列表与明细共用同一套过滤与汇总 helper。
  - 不改路由、不改响应结构。
- 压测脚本：
  - 新增 `scripts/stress/desktop-full-chain-soak.mjs`，通过真实 API 完成员工导入、月度导入、重算、确认、历史查询、已确认结果查询。
  - 脚本每分钟向 `artifacts/metrics-*.json` 落一次结构化快照，结束时输出 `summary.json` 与 stdout JSON。
- 运行方式：
  - 先启动固定端口 API。
  - 真实 Electron 壳通过 `SALARY_TAX_API_BASE_URL` 连接该 API。
  - 压测脚本负责负载回放；恢复阶段通过外部重启 API 验证脚本与系统是否收敛。

## 4. 涉及模块

- `apps/api/src/repositories/annual-tax-result-repository.ts`
- `apps/api/src/services/confirmed-results-service.ts`
- `apps/api/src/annual-results.test.ts`
- `apps/api/src/confirmed-results.test.ts`
- `scripts/stress/desktop-full-chain-soak.mjs`
- `scripts/stress/desktop-full-chain-soak.test.mjs`
- `docs/stress/2026-04-10-desktop-full-chain-soak/*`
- `docs/tasks.md`
- `PROGRESS.md`
- `docs/context/latest_context.md`

## 5. 数据结构变更

- 不新增表，不改现有表结构。
- 仅调整 `annual_tax_results` / `annual_tax_result_versions` 的写入条件：
  - 无变更重算不再新增版本历史记录。
- 不改变现有主键、唯一约束与签名规则。

## 6. 接口变更

- HTTP API：无变更。
- 新增 CLI：
  - `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes <number> --api-base-url <url> --db-path <path> --seed-employees <number> --tax-year <number> --unit-name <name> --output-dir <path> --phase-profile desktop-full-chain`
- CLI 默认 stdout 输出 JSON：
  - `status`
  - `data.phaseMetrics`
  - `data.dbStats`
  - `data.findings`
  - `error`

## 7. 风险评估

- 中高风险：
  - 版本历史语义调整可能影响历史查看预期。
  - `confirmed-results` 批量化若过滤条件处理不严，可能误伤离职员工或空白确认月逻辑。
- 可控风险：
  - 不改 HTTP 形状，不改数据库 schema，回退范围清晰。
  - 有现成 API 回归测试可作为护栏。
- 剩余风险：
  - 真实 Electron 壳页面级“人工可见性”仍需在最终运行前后做壳层启动检查，无法用现有仓库自动化完全替代。

## 8. 回退方案

- 若版本历史去重引入语义错误：
  - 回退 `annual-tax-result-repository.ts` 的去重判断，恢复“每次重算都追加版本”。
- 若 `confirmed-results` 批量化引入结果偏差：
  - 回退 `confirmed-results-service.ts` 到逐员工查询实现。
- 若压测脚本异常：
  - 保留文档与工作区产物，回退脚本文件，不影响产品运行链路。

## 9. 任务拆解

- [x] 创建方案文档与压测工作区骨架。
- [x] 修复年度结果版本历史去重逻辑。
- [x] 优化 `confirmed-results` 列表与明细查询路径。
- [x] 补充 API 回归测试与 CLI 脚本测试。
- [x] 实现桌面端全链路压测脚本并验证短时样本可运行。
- [x] 执行真实 Electron 壳前置检查。
- [x] 执行 `--duration-minutes 60` 长稳压测与恢复阶段验证，并产出 `full-run-1h/summary.json`。
- [x] 同步 `docs/tasks.md`、`PROGRESS.md`、`docs/context/latest_context.md`。
- [x] 修正压测脚本 baseline 窗口未占满的时长分配问题，确保后续复跑可严格对齐 60 分钟。
