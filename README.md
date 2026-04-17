# 工资薪金个税计算器（dude-tax）

面向财务、薪酬和内部复核场景的 Windows 离线桌面软件，用于按“单位 + 年份”管理工资薪金个税相关数据。当前版本聚焦最小可用闭环：单位管理、员工档案、月度录入、缴纳确认、历史查询、快速试算、政策参考和系统维护。

下载入口：[window安装包](https://github.com/Reirei-syu/dude-tax/releases/download/installer-latest/dude-tax-installer-x64.exe)

## 功能概览

- 单位管理：创建单位、维护备注、补充年度作用域。
- 员工信息：维护员工档案，支持批量导入员工名单。
- 月度数据录入：按年度员工列表维护 12 个月数据，支持批量导入、批量复制、异常月份强提示。
- 缴纳确认：按月份顺序确认，锁定已确认月份，保证结果可追溯。
- 历史查询：按单位、年度查看已确认结果与历史记录。
- 快速计算：做不落库的临时试算，与正式业务数据隔离。
- 政策参考：查看当前税率与政策说明。
- 系统维护：税率版本、作用域绑定、审计日志、单位备份。

## 技术栈

- 桌面壳：Electron
- 前端：React 19 + React Router + Vite
- 本地 API：Fastify
- 数据库：SQLite（`better-sqlite3`）
- 共享逻辑：TypeScript workspace packages
- 打包：Electron Packager + Inno Setup

## 目录结构

```text
.
├─ apps/
│  ├─ api/          # 本地 API、SQLite 初始化、业务路由
│  └─ desktop/      # Electron 主进程、预加载、React 前端
├─ packages/
│  ├─ core/         # 共享领域模型、校验、布局协议、计算相关纯逻辑
│  └─ config/       # 默认配置、模块导航、静态常量
├─ scripts/         # 打包、发布前检查、压力测试脚本
└─ .github/
   └─ workflows/    # Windows release workflow
```

## 运行要求

- Windows 10/11
- Node.js 22+（本地开发）
- npm 10+（本地开发）

## 本地开发

### 1. 安装依赖

```bash
npm ci
```

### 2. 启动开发环境

```bash
npm run dev
```

默认会同时启动：

- `apps/api`：本地 API，默认监听 `http://127.0.0.1:3001`
- `apps/desktop`：Vite + Electron 开发壳

### 3. 开发环境数据库

开发态默认使用独立数据库：

```text
data/dev/dude-tax.dev.db
```

这份库与用户已安装软件的数据强制隔离，不会再共用 `%APPDATA%` 下的旧数据库。

## 安装版数据库策略

- 安装版优先使用：

```text
{安装目录}\data\dude-tax.db
```

- 如果安装目录不可写，则自动回退到：

```text
{userData}\data\dude-tax.db
```

- 当用户从旧版本升级时，如果安装目录下还没有数据库，但旧 `userData` 库存在，程序会在首次启动时自动复制迁移旧库，并一并复制 `-wal` / `-shm` 文件。

## 常用命令

```bash
# 启动开发环境
npm run dev

# 运行所有测试
npm run test

# 运行类型检查
npm run typecheck

# 构建本地 API
npm run build:api

# 构建桌面前端
npm run build:desktop

# 生成 Windows 测试包
npm run package:win

# 生成 Windows 安装包
npm run release:win
```

## 打包与发布

### 本地打包

```bash
npm run release:win
```

默认产物位置：

```text
D:\coding\completed\dude-tax\dude-tax-installer-x64.exe
```

### GitHub Release

仓库内已经配置 Windows 发布工作流：

- 工作流文件：`.github/workflows/windows-release.yml`
- 滚动下载资产标签：`installer-latest`
- 稳定下载地址：`https://github.com/Reirei-syu/dude-tax/releases/download/installer-latest/dude-tax-installer-x64.exe`

README 顶部的 [window安装包](https://github.com/Reirei-syu/dude-tax/releases/download/installer-latest/dude-tax-installer-x64.exe) 就是这个稳定入口。

## 推荐使用流程

1. 创建或选择单位。
2. 确认当前税务年度。
3. 维护员工信息，必要时批量导入。
4. 录入月度数据或导入模板数据。
5. 执行年度计算。
6. 按月份做缴纳确认。
7. 通过历史查询复核已确认结果。
8. 在系统维护中做税率维护和单位备份。

## 当前已知限制

- 当前版本仍以最小可用闭环为主，个税计算引擎不是最终版。
- 单位备份当前只支持导出，不支持恢复。
- 前端构建仍有大 chunk warning，但不影响安装包生成。

## 仓库说明

- 主分支：`master`
- 远程仓库：`https://github.com/Reirei-syu/dude-tax`

如果你只想下载安装使用，直接点击顶部的 [window安装包](https://github.com/Reirei-syu/dude-tax/releases/download/installer-latest/dude-tax-installer-x64.exe) 即可。
