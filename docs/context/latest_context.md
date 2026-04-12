# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 修复安装版 `Failed to fetch` 并重新打包本地安装包已完成

## 已完成

- 已定位安装版 `Failed to fetch` 根因：
  - 安装环境下前端可能拿不到 preload 注入的 `apiBaseUrl`
  - `fetch` 退回 `file://` 地址后直接失败
- 已完成修复：
  - 主进程把 `salaryTaxApiBaseUrl` 注入到窗口 URL 查询参数
  - API 客户端新增从查询参数读取本地 API 地址的兜底逻辑
  - 已补充 `client.test.ts` 与 `electron-runtime-config.test.ts`
- 已重新生成本地安装包：
  - `D:\coding\completed\dude-tax\dude-tax-installer-x64.exe`
- 当前版本保持不变：
  - `0.1.0-alpha`
- 根项目与各 workspace 版本已统一为 `0.1.0-alpha`
- 已新增 Windows 安装包脚本：
  - `scripts/build-installer.mjs`
  - `scripts/installer/dude-tax.iss`
- 已新增 GitHub Release 工作流：
  - `.github/workflows/windows-release.yml`
- 本地安装包已生成：
  - `dist-electron/installer/dude-tax-installer-x64.exe`
- 安装包固定资产名：
  - `dude-tax-installer-x64.exe`
- 稳定下载策略：
  - 版本发布使用 `v*` tag
  - 固定滚动 release tag 使用 `installer-latest`
- `packages/core` 新增 `EmployeeRosterStatusKind`
  - `hired_this_year`
  - `active`
  - `left_this_year`
  - `left`
- `packages/core` 新增 `deriveEmployeeRosterStatus(employee, taxYear)`
- `apps/desktop` 新增 `EmployeeEditDialog`
- `EmployeeManagementPage` 已拆分为：
  - 固定“新增员工”卡片
  - 独立“编辑员工”对话框
- 员工列表已接入基于 `currentTaxYear` 的四态状态文案
- 页面新增“隐藏已离职员工”开关，仅过滤以前年度离职员工
- 已补齐：
  - `docs/context_memory/memory.md`
  - `.gitignore` 中的 Agent 内部文档忽略规则

## 关键决策

- 稳定下载链接不走 `releases/latest/download/...`，改为固定 tag：
  - `releases/download/installer-latest/dude-tax-installer-x64.exe`
- 后续每次版本发布都用同名安装包资产覆盖 `installer-latest` release
- “本年/以前年度”统一相对 `AppContext.currentTaxYear`
- 本年入职且本年离职时，状态优先显示为 `YYYY-MM-DD离职`
- “隐藏已离职员工”默认关闭，不做本地持久化
- 本轮不改数据库结构、不改 API 路由

## 当前测试状态

- 已通过：
  - `npm run test --workspace @dude-tax/desktop -- src/api/client.test.ts src/electron-runtime-config.test.ts`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run release:win`
  - `npm run test --workspaces --if-present`
  - `npm run typecheck --workspaces --if-present`
  - `npm run release:win`
  - `npm run test --workspace @dude-tax/core -- employee-status.test.ts`
  - `npm run test --workspace @dude-tax/desktop -- employee-list-filter.test.ts employee-management-page.test.ts`
  - `npm run typecheck --workspace @dude-tax/core`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run typecheck --workspace @dude-tax/api`
  - `git status --ignored --short`

## 剩余任务

- 如需同步 GitHub 下载包，需要手动上传当前修复后的安装包
- 如需让正式安装目录 `D:\DudeTax` 生效，需要重新安装这次新包

## 下一步计划

1. 用新安装包覆盖安装到 `D:\DudeTax`
2. 验证首页和“新建单位”不再出现 `Failed to fetch`
3. 如有需要，再同步更新 GitHub Release 资产
