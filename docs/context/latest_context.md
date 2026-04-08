# 当前上下文摘要

## 当前阶段

- 项目处于 `v0.1.0-alpha`
- Release Readiness 修复清单已启用
- P0 已全部完成
- P1 已全部完成
- P2 第一项已完成
- P2 第二项已完成
- P2 第三项已完成
- P3 第一项已完成
- P3 第二项已完成
- P3 第三项已完成
- 当前主线任务已全部完成

## 本轮已完成

- 完成 P2 第一项：结果失效判定改为 `policy_signature + data_signature`
- 为 `annual_tax_results`、`annual_tax_result_versions`、`annual_calculation_runs` 增加 `data_signature`
- 新增共享签名构造：当前年度月度记录 + 跨单位结转记录 + 派生预扣上下文共同参与签名
- 历史版本和重算状态现可区分 `tax_policy_changed` 与 `month_record_changed`
- 兼容旧库空签名：空 `data_signature` 会被视为“需要重算”，不会误判为当前有效
- 完成 P2 第二项：新增 `POST /api/history-results/recalculate`
- 历史结果重算与差异解释已收口到 API，前端已移除对核心计算的直接调用
- 完成 P2 第三项：为关键业务表补齐 SQLite `CHECK` 约束
- 数据库迁移采用“预检查 + 影子表重建”策略，旧表合法数据可自动迁移，脏数据会阻止自动升级
- 完成 P3 第一项：导入服务改为单事务全成功提交，并去掉预览/提交阶段的 N+1 查询
- 导入成功后会清理 `import_preview_summaries`，避免继续展示过期导入冲突摘要
- 完成 P3 第二项：`AnnualResultsPage.tsx` 与 `HistoryQueryPage.tsx` 已拆成 hooks / components / constants 结构
- 两个主页面文件当前分别约 55 行与 57 行，副作用已移到 page-specific hooks
- 完成 P3 第三项：方案标签、结算方向标签、预扣模式标签已统一提升到 `packages/core`
- API 与前端展示层已切换到共享映射来源，不再各自维护核心标签常量
- 已通过：
  - `npm run typecheck`
  - `npm run test --workspace @dude-tax/api`

## 当前阻塞

- `apps/api/src/import-summary-repository.ts` 之外的其他一行文件仍待后续治理
- 仍有部分历史测试与工具文件保留 `packages/core/src` 直引，但不影响当前主线功能闭环

## 关键决策

- 乱码问题采取“确认真实损坏范围后最小修复”的策略，避免误改正常 UTF-8 中文
- 单行源码恢复阶段只做格式恢复，不引入业务逻辑变化
- `data_signature` 不直接取整表原始 JSON，而是只覆盖实际会影响年度结果和预扣规则解释的输入
- 当前月度数据变更仍会删除“当前结果/重算状态”行；本轮主要补齐历史版本、兼容旧库和签名语义
- 历史结果对比接口返回共享类型与已格式化差异项，前端只消费 API 输出，不再本地拼装比较逻辑
- `employee_month_records.status` 的真实枚举是 `incomplete/completed`，后续迁移必须按当前代码口径建约束，不能套用旧草案中的 `normal/deleted/draft`
- 对 SQLite 收紧约束时，必须把“旧数据预检查”和“失败不替换旧表”作为默认策略
- 导入事务方案已固定为“全成功才提交”，优先保证财税数据可回退和状态可解释
- 页面拆分本轮不顺手做文案全局化，只先抽 hooks / components / constants，为下一项“统一文案映射与解释逻辑”留出落点
- 主页面本身不再保留 `useState / useEffect / useMemo`，只负责组装 section
- 统一映射时优先提升展示标签来源，不顺手重写 explanation helper 业务语义
- 当前主线收口后，后续优化任务默认转向遗留一行文件治理与剩余源码级直引清理

## 下一步

- 当前主线任务已完成，可进入整体收口 review 或遗留技术债清理
