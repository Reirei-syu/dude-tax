# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 系统维护新增单位备份模块已完成

## 已完成

- `packages/core` 新增单位备份协议：
  - `UnitBackupDraftResponse`
  - `CreateUnitBackupPayload`
  - `CreateUnitBackupResponse`
  - `UnitBackupManifest`
  - `UnitBackupSummaryCounts`
- `apps/api` 新增单位备份能力：
  - `GET /api/units/:unitId/backup-draft`
  - `POST /api/units/:unitId/backup`
  - `apps/api/src/services/unit-backup-service.ts`
- `apps/desktop` 新增 Electron 保存路径桥接：
  - `salary-tax:pick-save-path`
  - `window.salaryTaxDesktop.pickSavePath(...)`
- 系统维护页新增默认折叠的“单位备份”卡片：
  - 展示当前单位、纳入备份年份、最近备份目录、建议文件名
  - 支持“选择备份位置”和“开始备份”
  - 成功后展示最近一次备份结果摘要
- 静态文档已同步：
  - `AGENTS.md`
  - `PROJECT_SPEC.md`
  - `prd.md`
  - `docs/tasks.md`
  - `PROGRESS.md`

## 关键决策

- 备份范围固定为“当前单位下全部年份业务数据”，不做整库备份。
- 备份文件格式固定为 ZIP，内部单文件 `backup.json`。
- ZIP 压缩使用 Windows PowerShell `Compress-Archive`，当前不新增压缩依赖。
- 最近备份目录按全局偏好记忆，键名为 `backup_last_directory`。
- 备份清单除单位业务表外，还会追溯当前单位关联的 `tax_policy_versions`、`tax_policy_scopes` 与 `tax_policy_audit_logs`。
- 本期只做备份，不做恢复。

## 当前测试状态

- 已通过：
  - `npm run test --workspace @dude-tax/api -- unit-backup.test.ts`
  - `npm run test --workspace @dude-tax/desktop -- maintenance-page.test.ts api/client.test.ts`
  - `npm run build --workspace @dude-tax/api`
  - `npm run build --workspace @dude-tax/desktop`
  - `npm run typecheck --workspace @dude-tax/api`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run package:win`

## 剩余任务

- 当前实现任务已完成
- 如需进一步验证，可在测试包中手工走一次“选择备份位置 -> 开始备份 -> 再次备份”的桌面回归

## 下一步计划

1. 如需继续扩展，可设计“单位备份恢复”链路
2. 如需降低平台耦合，可将 ZIP 生成从 PowerShell 替换为跨平台实现
3. 如需增强发布信心，可在打包产物中手工验证最近目录记忆行为
