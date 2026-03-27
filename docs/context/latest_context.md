# 当前上下文摘要

## 当前阶段
- 项目处于 `v0.1.0-alpha`
- Release Readiness 修复清单已启用
- P0 已全部完成，当前下一步为 P1

## 本轮已完成
- `apps/api` 已建立生产构建链，输出 `dist/server.mjs`
- Electron 生产包改为启动编译后的 API 入口
- 打包前会获取 Electron 目标 ABI 的 `better-sqlite3` 预编译二进制
- 打包后会恢复本地开发环境的 Node ABI，避免污染 `npm test`
- Windows 测试包 smoke 已通过：
  - 打包产物可启动
  - 本地 API 可监听 `127.0.0.1:3001`
  - 用户数据目录数据库可成功初始化

## 当前阻塞
- P0 已无阻塞
- P1 尚未开始，仓库中仍存在大量中文乱码
- 多个核心文件仍为单行压缩状态，尚未恢复可维护结构

## 关键决策
- 生产运行链路不再依赖 `tsx` 和 `apps/api/src/server.ts`
- `package:win` 以编译后产物为准，不再以源码目录为运行入口
- `better-sqlite3` 优先走预编译二进制，不在当前环境依赖本地 C++/Windows SDK 编译

## 下一步
- 进入 P1 第一项：全量修复中文乱码
- 完成 P1 第一项并验证后，再执行 P1 第二项：恢复被压扁的一行源码文件
