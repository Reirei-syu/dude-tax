# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 固化初始 UI 默认值并重新打包已完成

## 已完成

- 已将运行态 `test` 单位的 UI 布局/导航顺序/折叠状态抽为默认初始化种子
- 安装后默认不保留任何开发单位，软件处于“无单位”状态
- 默认税率只保留 1 个版本，版本名固定为“最新”，审计日志清空
- 已重新生成 Windows 安装包
- 政策参考页已删除顶部 `政策参考` 卡片，并切换到新一组稳定 `cardId`
- 工作区布局状态已新增 `collapsedSections`，可按页面 scope 持久化折叠状态
- `CollapsibleSectionCard`、导入工作区分组壳、系统维护页自管折叠区已统一接入持久化
- 目标 desktop/api 测试与全量 typecheck 已通过
- 工作区布局已升级为 `0.1 格` 精度，并新增 `z` 层级持久化
- 卡片拖拽/缩放结束后不再自动吸附或解碰撞，宽工作区中允许重叠摆放
- 卡片非交互区右键菜单已支持“顶置 / 靠左 / 靠右”
- “自动排列”已改为显式整理动作，会微调卡片宽高并消除重叠
- 目标 desktop/api 测试与全量 typecheck 已通过
- `/result-confirmation` 导航标签与首页建议文案已统一改为“缴纳确认”
- 月度录入主卡片与员工列表编辑内容已合并为“月度数据手工录入”
- 缴纳确认页主工作卡片已改为“已纳税月份确认”，4 个状态栏已移除
- 系统维护页顶部 `maintenance-header` 卡片已删除，其余卡片默认布局已整体上移
- 工作区布局已支持清理废弃 `cardId`，避免旧布局残留空白
- 目标静态测试、桌面端 typecheck 与 smoke 脚本语法检查已通过
- 本地 API 支持保存 / 读取导航抽屉、页面布局、弹窗布局偏好
- 本地 API 支持保存 / 读取导航顺序偏好
- 工作区布局控制器已修复渲染循环，fresh dev session 不再出现 `Maximum update depth exceeded`
- 导航点击失效问题已修复，主模块可正常切换
- 导航排序已改为排序模式下通过右侧上下箭头移动
- 排序模式下导航文字区已禁用，避免误触进入模块
- 排序开关已改为 icon-only 按钮
- 导航项宽度已恢复为原统一宽度，排序按钮尺寸也已回调为原侧栏按钮尺寸
- 排序态箭头控件已改为悬浮在导航项右侧，可超出导航栏边缘显示
- 排序态箭头按钮已进一步缩小，避免上下重叠
- 主要页面工作区卡片接入自由布局
- 主要弹窗接入浮动窗口布局
- 卡片与主要弹窗正文区支持整体等比缩放
- 左下角缩放手柄、底部临时空白区扩展与自动排列已接入
- 员工批量导入区滚动与“隐藏已离职员工”单行样式已修复
- 手动缩放结束后不再自动吸附位置
- 全量 API / desktop 测试、全量 typecheck、API/desktop build 均通过

## 关键决策

- 页面布局按页面 scope 记忆，不按单位 / 年份拆分
- 导航顺序全局记忆
- 顶部上下文状态卡固定
- 小型确认弹窗不纳入自由布局
- 底部扩展空白区只在当前页面会话内有效

## 当前问题

- 暂无功能阻断问题
- 仅保留 Vite 大 bundle warning 作为后续优化项
- 浏览器直连 `4175 -> 3001` 会出现 CORS 噪音，该问题不影响桌面壳交付路径

## 当前测试状态

- `npm run test --workspace @dude-tax/desktop -- src/components/navigation-order.test.ts src/components/workspace-layout-structure.test.ts src/pages/home-page.test.ts src/pages/annual-results/components/annual-results-overview-section.test.ts`
- `npm run typecheck --workspace @dude-tax/desktop`
- 浏览器冒烟已验证左侧导航切页、排序模式禁跳转、箭头移动顺序、首页入口跳转

## 下一步计划

1. 在真实安装包里补一轮“首次启动无单位 + 默认 UI 布局 + 恢复默认布局”的手点烟测
2. 继续处理 `.gitignore` 已追踪 Agent 文档清理任务
3. 如需继续优化，处理桌面端包体拆分
