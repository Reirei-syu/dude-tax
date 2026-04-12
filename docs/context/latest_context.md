# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- Windows 安装包首发与 GitHub Release 发布已完成

## 已完成

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

- 将本地首发版本提交并推送到 GitHub
- 创建 GitHub 首个版本 release 与滚动稳定下载 release

## 下一步计划

1. 提交并推送当前首发版本链路改动
2. 创建 `v0.1.0-alpha` 版本 release
3. 上传 `installer-latest` 稳定下载资产并返回固定 URL
