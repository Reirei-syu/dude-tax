# 真实业务试点上线边界收口方案

## 1. 背景
- 当前项目主业务模块已经打通，但距离“真实业务试点可上线测试”仍差桌面交付链、系统维护治理能力和结果来源透明化
- 用户要求直接落实试点收口方案，而不是继续停留在评审阶段

## 2. 目标
- 补齐桌面运行时 API 注入、用户数据目录和 Windows 测试包脚本
- 补齐系统维护的审计日志、解绑恢复继承、版本差异与影响预览
- 补齐结果中心 / 历史查询的规则来源说明
- 将运行时依赖审计收敛到 `npm audit --omit=dev = 0`

## 3. 设计方案
- 桌面端通过 `preload + additionalArguments` 接收运行时 API 基地址，不再在 React 客户端写死地址
- 生产包由 Electron 主进程尝试拉起本地 API 子进程，并向 API 注入 `PORT` 与 `DUDE_TAX_DB_PATH`
- 系统维护在后端新增 `tax_policy_audit_logs`，并由税率仓储统一记录保存、激活、绑定、解绑操作
- 税率版本差异与影响预览按当前单位 / 年度作用域计算，不先扩展到全局矩阵视图
- 结果快照在服务层补充 `ruleSourceSummary`，前端统一渲染规则来源说明

## 4. 涉及模块
- `apps/desktop`
- `apps/api`
- `packages/core`
- `docs/tasks.md`
- `docs/context/latest_context.md`
- `PROGRESS.md`

## 5. 数据结构变更
- 新增表：`tax_policy_audit_logs`
- 扩展结果结构：`AnnualTaxCalculation.ruleSourceSummary`
- 扩展税率响应结构：`auditLogs`、`TaxPolicyVersionImpactPreview`

## 6. 接口变更
- 新增：`GET /api/tax-policy/versions/:versionId/impact-preview`
- 新增：`POST /api/tax-policy/scopes/current/unbind`
- 扩展：`GET /api/tax-policy` 返回审计日志

## 7. 风险评估
- Windows 测试包目前仍卡在 `better-sqlite3` 的 Electron ABI 重编，打包成功不等于 smoke 成功
- 关闭 `asar` 能提高子进程可运行性，但会放大分发体积
- 系统维护能力已补齐，但更复杂税务口径仍未完全收口

## 8. 回退方案
- 桌面壳改动集中在 `apps/desktop/electron/main.cjs`、`preload.cjs` 与 `src/api/client.ts`
- 税率治理改动集中在 `tax-policy` 仓储 / 路由与系统维护页面
- 若打包链继续不稳定，可保留现有脚本和 smoke 失败结论，先不把测试包作为“已通过”验收项

## 9. 任务拆解
- [x] 桌面端运行时 API 注入
- [x] 用户数据目录数据库默认路径
- [x] 税率变更审计日志
- [x] 作用域解绑恢复继承
- [x] 税率版本差异与影响预览
- [x] 结果页规则来源说明
- [x] 运行时依赖审计归零
- [x] Windows 测试包打包脚本
- [ ] `better-sqlite3` Electron ABI 重编与 smoke 验证
