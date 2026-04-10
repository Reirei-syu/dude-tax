# 项目进度与状态

- 更新时间：2026-04-10
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：系统维护模块结构调整与版本改名刷新修复
- 方案路径：无（按会话确认计划执行）

## 本轮修改

- 首页：
  - 删除“工作提醒”和“工作建议”卡片
  - 新增“政策口径”卡片，展示当前版本、政策说明条数和当前口径状态
  - 新增“前往政策参考”入口
  - 首页税率数据改为读取当前单位 / 年度作用域，避免只看全局默认
- 初始默认内容：
  - 从 Electron 用户库中提取 7 条扣除项说明及配图，固化为 `apps/api/src/default-policy-content.json`
  - 新增 `default-policy-content.ts` helper，统一读取默认政策内容
  - 数据库初始化在首次建库时，会把这 7 条写入“初始税率版本”的 `maintenance_notes`
  - 税率仓储默认内容与数据库初始种子改为同源，避免默认值和初始化版本不一致
  - API 构建流程新增默认政策内容 JSON 复制，保证打包后运行时可读取
- 系统维护页：
  - 扣除项说明每个子卡片头部新增单项“保存”按钮
  - 子卡片头部按钮顺序固定为“保存、删除、折叠”
  - “折叠说明条目”文案简化为“折叠”，收起态切换为“展开”
  - “删除说明条目”文案简化为“删除”
  - 子卡片“保存”只提交当前条目，其它说明项与税率草稿保持本地未保存状态
  - 当前子卡片内新增条目级成功 / 失败反馈
- 政策参考页：
  - 扣除项说明中的图片缩略图新增“点击查看原图”入口
  - 新增页内原图预览层，支持点击遮罩、关闭按钮和 `Esc` 键关闭
  - 原图预览层新增“缩小 / 放大 / 重置”按钮
  - 支持滚轮缩放图片
  - 图片放大后，按住鼠标左键可拖拽平移，交互表现为抓手工具
  - 保持现有政策条目正文、排序和卡片折叠逻辑不变
- 系统维护页：
  - “保存扣除项说明”按钮右侧新增“新增说明条目”按钮
  - 扣除项说明卡片内补充可见的成功 / 失败提示，避免总览卡折叠时错误信息被隐藏
  - 税率保存路由放宽请求体与插图 `data URL` 长度限制，修复图片保存后切换模块回退旧状态的问题
  - “扣除项说明”中的每个子说明条目新增独立折叠按钮
  - 子项默认展开，折叠后仅保留标题区、序号标签和操作按钮
  - 子项折叠只影响当前前端页面状态，不影响保存链路
  - “扣除项说明”功能新增“删除说明条目”按钮
  - 删除前弹出中文确认提示，防止误删
  - 删除仅变更当前前端草稿，仍需点击“保存扣除项说明”后才会真正落库
  - 删除后自动重排条目 `sortOrder`，保持政策参考页展示顺序稳定
  - 同步补充源码断言测试，锁定删除入口与提示文案
  - 删除模块内“系统维护”总览卡，改为独立页头展示标题、当前房间、当前版本摘要、编辑状态与全局反馈
  - 新增默认折叠的“税率维护”父卡，将扣除项说明、基本减除费用、综合所得税率表、年终奖单独计税税率表收纳为内层子卡
  - 父卡展开后保留四张子卡原有折叠行为，说明卡 / 基本减除费用继续全宽，两张税率表继续双列展示
  - 税率版本改名成功后会显式重新拉取当前作用域配置，确保版本列表、当前版本名、作用域绑定名称与审计日志同步刷新
  - 修复税率版本改名请求在桌面端报 `Failed to fetch` 的问题：本地 API CORS 允许方法补充 `PATCH`
- 共享折叠能力：
  - 新增 `CollapsibleSectionCard` 共享组件，统一承载标题、描述、头部扩展区、折叠按钮与 `hidden` 内容区
  - 复用既有 `.collapsible-card-body[hidden]` 隐藏机制，只补充头部操作区样式
- 活页面接入：
  - 首页四张顶层卡片接入统一折叠壳，其中“当前税率表”默认折叠
  - 单位管理页四张顶层卡片接入统一折叠壳，删除单位认证卡仅在出现时展示且默认展开
  - 员工信息页主表单卡与员工列表卡接入统一折叠壳，员工批量导入工作区维持原默认折叠
  - 月度数据录入页仅主卡接入统一折叠壳，导入工作区、员工编辑列表、计算结果汇总保持原折叠实现
  - 快速计算页主卡与试算结果卡接入统一折叠壳，试算结果在存在结果时默认展开
  - 结果确认页主卡接入统一折叠壳
  - 计算中心页主卡接入统一折叠壳，“员工计算准备状态”默认折叠
  - 政策参考页四张顶层卡片接入统一折叠壳，其中两张税率表默认折叠
  - 历史查询页主卡接入统一折叠壳
- 回归边界：
  - 系统维护页 `defaultCollapsedSections` 保持不变
  - 月度数据录入页 `isEmployeeListCollapsed` / `isResultListCollapsed` 保持不变
  - 员工信息页与月度数据录入页 `ImportWorkflowSection defaultCollapsed={true}` 保持不变
- 测试补充：
  - 新增 API 回归测试，验证超过旧限制长度的插图可保存并重新读取
  - 新增共享组件测试与首页、单位管理、计算中心、历史查询页面测试
  - 扩展政策参考、员工信息、月度数据录入、快速计算、结果确认页面测试，锁定默认折叠矩阵
  - 新增系统维护页结构断言，锁定独立页头、“税率维护”父卡与四张税率相关子卡的嵌套关系
  - 新增带 `unitId` / `taxYear` 的税率版本改名回归测试，锁定作用域绑定名称同步刷新

## 影响范围

- `apps/api`
- `apps/desktop`
- `docs`

## 任务进度

- 当前主任务进度：100%
- 已完成：
  - 系统维护模块结构调整与版本改名刷新修复
  - 首页精简与政策口径卡片
  - 初始税率版本默认 7 条扣除项说明种子
  - 系统维护说明子卡片单项保存入口与头部按钮顺序调整
  - 政策参考页原图预览缩放与拖拽能力
  - 政策参考页图片原图预览能力
  - 系统维护页扣除项说明子项折叠能力
  - 系统维护页扣除项说明删除能力
  - 共享折叠卡片组件落地
  - 当前活路由页面顶层工作区卡片按既定矩阵接入折叠能力
  - 既有维护页、导入工作区、月度录入局部折叠逻辑保持不变
  - 桌面端源码断言测试补齐
  - 桌面端测试、类型检查、构建通过
- 未完成：
  - Windows / Electron 手工烟测导入与系统维护主流程
  - Windows / Electron 手工烟测新增工作区卡片折叠交互

## 验证结果

- `npm run test --workspace @dude-tax/desktop`
- `npm run test --workspace @dude-tax/api`
- `npm run typecheck --workspace @dude-tax/api`
- `npm run typecheck --workspace @dude-tax/desktop`
- `npm run build --workspace @dude-tax/api`
- `npm run build --workspace @dude-tax/desktop`
- `node --import tsx --test src/pages/home-page.test.ts`（`apps/desktop`）
- `node --import tsx --test src/default-policy-content.test.ts`（`apps/api`）
- `node --import tsx --test src/pages/current-policy-page.test.ts`（`apps/desktop`）
- `node --import tsx --test src/pages/maintenance-page.test.ts`（`apps/desktop`）
- `node --import tsx --test src/policy-content.test.ts`（`apps/api`）
- `node --import tsx --test src/components/collapsible-section-card.test.ts src/pages/current-policy-page.test.ts src/pages/employee-management-page.test.ts src/pages/month-record-entry-page.test.ts src/pages/quick-calculate-page.test.ts src/pages/result-confirmation-page.test.ts src/pages/calculation-center-page.test.ts src/pages/unit-management-page.test.ts src/pages/home-page.test.ts src/pages/history-query-page.test.ts`（`apps/desktop`）
- `npm run test --workspace @dude-tax/api -- tax-policy.test.ts`
- `npm run test --workspace @dude-tax/desktop -- maintenance-page.test.ts`
- `npm run build --workspace @dude-tax/desktop`
- `node --import tsx --test src/cors.test.ts`（`apps/api`）

## 风险备注

- `vite build` 仍有 bundle 过大 warning，但构建成功，不影响本轮交付。
- 新增统一折叠壳目前只经过源码断言、类型检查与构建验证，尚未在 Electron 桌面壳内逐页点按确认。
- 当前工作树存在用户未提交的 API / 文档相关改动，本轮未触碰这些实现逻辑，只在桌面端页面层与文档层增量修改。
- 插图保存回退的逻辑原因已定位为税率保存路由对请求体与 `illustrationDataUrl` 长度限制过小，且失败提示原本容易被折叠总览卡隐藏。
- 系统维护页本轮新增了“父卡 + 子卡”两级折叠结构，自动化验证已通过，但仍需在 Electron 桌面壳内补一次真实点按烟测。
- 本地 API 之前只放行了 `PUT`，未放行 `PATCH`，导致版本改名这种带 JSON body 的跨源请求在浏览器预检阶段直接失败。

## Lessons Learned

- 首页类总览页如果同时承载“提醒、建议、政策展示”会迅速失焦；精简成少量高价值入口更适合桌面工具首屏。
- 对“安装后就要有默认业务内容”的需求，不能依赖开发机当前数据库；必须把内容固化到仓库资源并接入初始化逻辑。
- 运行时需要读取的非代码资源如果放在 API 源码目录里，构建流程必须显式复制到 `dist-runtime`，否则打包后会丢文件。
- 当页面已经存在整组保存链路时，补“单项保存”入口不一定要新增 API；前端可以基于服务端基线只合并目标条目，从而避免误提交其它未保存草稿。
- 对图片原图预览这类增强交互，缩放与平移应放在同一个受控视口里处理，避免把拖拽事件直接绑到图片元素上导致选中、拖影或关闭层误触。
- 对“点击缩略图查看原图”这类桌面端预览交互，优先复用现有页内遮罩层样式，比引入新窗口或浏览器跳转更符合离线桌面软件体验。
- 对“卡片内子项折叠”这类局部交互，优先只控制展示容器，不额外引入持久化状态，能明显降低与现有保存逻辑的耦合风险。
- 对桌面端“Base64 图片随表单保存”的场景，要同时检查字段级校验上限与 HTTP 请求体限制；只放宽其中一层不能真正修复持久化问题。
- 关键保存操作的成功 / 失败提示不能只放在默认折叠区域，否则用户会把失败误判成已保存。
- 对这类“列表项删除”交互，删除动作应先只落在前端草稿，再复用现有统一保存入口，避免为单个子操作额外扩 API。
- 当页面使用数组顺序驱动展示时，删除条目后应立即重排 `sortOrder`，否则后续保存和展示顺序容易漂移。
- 使用原生 `hidden` 时，如果同一元素还被业务样式显式设置了 `display:flex/grid`，必须补充 `[hidden] { display: none; }` 覆盖规则，否则会出现“状态已折叠但视觉仍展开”。
- 页面层统一交互改造优先抽共享壳，而不是把折叠状态散落到每个页面各自维护；这样更容易锁默认矩阵，也更利于后续扩展。
- 在现有仓库测试体系以源码断言为主时，新增 UI 约束应继续沿用同一测试风格，避免为一次页面层小改造引入新的测试基础设施。
- 对“保存成功但用户感知未刷新”的问题，优先保证写操作后重新拉取源数据，而不是仅依赖当前请求返回体；这样更稳，尤其适合版本列表、作用域绑定和审计日志这类多区域联动界面。
- 当桌面端只在某个带请求体的方法上报 `Failed to fetch` 时，优先检查 CORS 预检允许方法列表，而不是先怀疑业务路由或前端状态管理。
