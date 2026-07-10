# Dude Tax

本地单机桌面工具：实时预估工资薪金累计预扣个税，并对比年终奖「单独计税」与「并入综合所得」两种方式。

**政策版本横幅**：基于 2026 年规则（年终奖单独计税优惠至 2027-12-31）

> 仅供人事参考，非正式报税软件。请以国家税务总局官方扣缴计算器与最终汇算清缴为准。

---

## 功能

- **累计预扣预缴**：严格实现 STA 公式（累计应纳税所得额、本期应预扣税额、5000×任职月数）
- **首次取得工资**：`isFirstTime` 时累计减除费用按日历月数计算
- **入职 / 离职**：设置日期 → 确认弹窗 → 清零对应月份 → 全卡片重算
- **年终奖优化**：单独计税 vs 并入综合所得，推荐较低税负方案并拆解说明
- **多工作区**：单位 + 年份隔离
- **持久化**：
  - **桌面 EXE（正式）**：Tauri + SQLite 文件 `dude-tax.db`（位于应用配置目录，可备份拷贝）
  - **浏览器开发回退**：sql.js + localStorage（非正式）
- **无限画布**：可拖拽卡片（花名册 / 工资 / 税额 / 年终奖 / 解读 / 全员汇总）

---

## Windows 开发

### 仅前端（浏览器）

```powershell
cd D:\coding\dude-tax2
pnpm install
pnpm dev
```

浏览器打开终端提示的地址（默认 `http://localhost:1420`）。数据保存在浏览器 localStorage。

### 桌面壳（推荐，正式路径）

需本机安装：

1. **Rust**（rustup，stable）
2. **MSVC 构建工具**（Visual Studio Build Tools，含「使用 C++ 的桌面开发」）
3. **WebView2**（Windows 10/11 一般自带；旧机安装 [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)）

```powershell
cd D:\coding\dude-tax2
pnpm install
pnpm tauri dev
```

### 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 前端开发服务器（Web 回退存储） |
| `pnpm test` | vitest 单元测试 |
| `pnpm build` | 前端生产构建到 `dist/` |
| `pnpm tauri dev` | 桌面开发（真 SQLite） |
| `pnpm tauri build` | 打包 Windows 安装包（NSIS） |

---

## 数据库位置与备份（EXE）

- 文件名：`dude-tax.db`
- 典型路径（Windows）：`%APPDATA%\com.dud.tax\dude-tax.db`  
  （以 `tauri.conf.json` 的 `identifier` 为准；应用内「数据位置」按钮可复制完整路径）
- **备份**：正常退出软件后，复制该 `.db` 文件即可
- **恢复**：关闭软件，用备份覆盖同名文件后再启动
- **注意**：用户数据在 AppData，**不在**安装目录；重装/升级一般不会删除该文件

首次启动时由 Rust migrations 自动建表。若本机曾用浏览器开发并产生 localStorage 数据，首次进桌面版时会尝试一次性导入（标记 `taxopt-helper-migrated-v1`）。

---

## 内部分发检查清单

1. 在构建机执行 `pnpm tauri build`
2. 产物目录：`src-tauri\target\release\bundle\nsis\`（安装程序）
3. 在干净 Windows 上安装并验证：
   - 新建单位 / 员工 / 录入工资 / 重启后数据仍在
   - 年度结转、单位删除
   - 「数据位置」路径可打开并看到 `dude-tax.db`
4. 向同事说明：备份即拷贝 `.db`；WebView2 依赖见上

---

## 与官方扣缴计算器核对

1. 在应用中创建员工，录入与官方计算器相同的 1–12 月工资、专项扣除、专项附加等。
2. 打开「预扣税额汇总」卡片，逐月对照「本期应预扣预缴税额」「累计预扣预缴税额」。
3. 边界建议用例：
   - 全年 10,000 元/月、无额外扣除、1 月入职
   - 6 月入职且勾选「首次取得工资」
   - 8 月离职（确认后 9–12 月税为 0）
   - 年终奖 36,000 / 144,000 等档位边界
4. 引擎源码：`src/lib/tax/engine.ts`、`src/lib/tax/brackets.ts`（纯函数，可用 `pnpm test` 回归）。

---

## 项目结构（核心）

```
src/
  lib/tax/          # 累计预扣 + 年终奖引擎 + 解释
  lib/store/        # Zustand
  lib/db/           # SqlClient + TaxRepository + bootstrap（Tauri / sql.js）
  components/cards/
  components/canvas/
src-tauri/
  migrations/       # SQLite schema 迁移
  capabilities/     # 插件权限
  src/lib.rs        # plugin-sql + migrations
```

---

## 免责声明

本工具计算逻辑按公开政策实现，用于薪酬规划与沟通参考。实际扣缴与汇算以税务机关认定为准。
