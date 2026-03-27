# 完整预扣预缴规则方案

## 1. 背景
- 当前 `packages/core/src/annual-tax-calculator.ts` 采用“年度汇总一次算清”的最小口径：
  - 汇总全年工资、年终奖、扣除和已预扣税额
  - 直接输出年度应纳税额、年度已预扣税额、应补/应退税额
- 这套实现能支撑当前最小闭环，但还不等价于工资薪金实际月度预扣预缴链路。
- `PENDING_GOALS.md` 中仍存在未完成项：`个税计算核心增强 -> 完整预扣预缴规则`。
- 该项属于高风险核心能力，会影响：
  - `packages/core` 计算模型
  - 结果中心与导出字段
  - 历史查询与版本对比的解释口径

## 2. 目标
- 在不破坏当前已上线闭环的前提下，为工资薪金个税补齐“累计预扣法”规则设计。
- 把“年度汇算结果”和“月度预扣轨迹”拆开建模。
- 支持后续逐步落地以下高价值场景：
  - 标准累计预扣法
  - 上年收入不超过 6 万元的简便优化预扣
  - 年度中间首次取得工资薪金所得的累计减除费用规则
  - 预扣轨迹解释、差异对账与导出

## 3. 设计方案

### 3.1 总体策略
- 保留现有 `AnnualTaxCalculation` 作为“年度结果壳”，但扩展其中的预扣预缴轨迹信息。
- 新增独立纯函数：
  - `buildMonthlyWithholdingTrace(records, context, taxPolicy)`
- 由该函数输出每月累计预扣过程，再由年度计算结果复用：
  - 年度应纳税额
  - 年度已预扣税额
  - 年度应补/应退税额
  - 月度预扣轨迹摘要

### 3.2 规则口径分层
- 第一层：年度汇算口径
  - 继续保留当前年度汇总结果，作为最终补税 / 退税结论来源。
- 第二层：月度预扣口径
  - 按累计预扣法逐月生成：
    - 累计收入
    - 累计减除费用
    - 累计专项扣除
    - 累计专项附加扣除
    - 累计其他扣除
    - 累计减免税额
    - 累计预扣应纳税所得额
    - 累计应预扣预缴税额
    - 本月应预扣预缴税额
- 第三层：对账口径
  - 将“规则计算出的本月应预扣税额”与“用户录入的实际已预扣税额”并列保留。
  - 当前数据库中的 `withheldTax` 继续视为“实际已预扣税额”。

### 3.3 关键规则范围
- 标准累计预扣法
  - 采用“累计收入 - 累计免税收入 - 累计减除费用 - 累计专项扣除 - 累计专项附加扣除 - 累计依法确定的其他扣除”形成累计预扣应纳税所得额。
  - 再按预扣率表计算累计应预扣预缴税额，减去累计减免税额和累计已预扣预缴税额，得到本期应预扣税额。
- 6 万元简便优化规则
  - 对上一完整纳税年度在同一单位每月均有工资薪金预扣且全年收入不超过 6 万元的居民个人，自 1 月起累计减除费用可直接按全年 6 万元计算。
  - 在累计收入不超过 6 万元的月份暂不预扣税款，超过 6 万元当月起再恢复预扣。
- 年度中间首次取得工资薪金所得规则
  - 对一个纳税年度内首次取得工资薪金所得的居民个人，可按 5000 元 / 月乘以截至本月月份数计算累计减除费用。
  - 该规则与上面的 6 万元优化规则不能混用，需要显式判定优先级。

### 3.4 数据建模建议
- `EmployeeMonthRecord.withheldTax`
  - 保持现义，继续表示“实际已预扣税额”。
- 新增核心类型：
  - `MonthlyWithholdingTraceItem`
  - `AnnualTaxWithholdingMode`
  - `AnnualTaxCalculation.withholdingTrace`
  - `AnnualTaxCalculation.withholdingSummary`
- `withholdingSummary` 最少包含：
  - `withholdingMode`
  - `actualWithheldTaxTotal`
  - `expectedWithheldTaxTotal`
  - `withholdingDifference`

### 3.5 参数与上下文建议
- 首版不要直接改数据库表结构，先在核心层与前端解释层完成。
- 需要新增一个“预扣规则上下文”输入对象，至少包含：
  - `previousYearIncomeUnder60k: boolean`
  - `isFirstSalaryMonthInYear: boolean`
  - `firstSalaryMonth?: number`
- 这些字段首版可先由“计算中心 / 结果中心的规则开关”或临时上下文提供，不急于直接写入数据库。
- 第二阶段若确认长期使用，再考虑把这些规则参数收敛为员工年度级配置表。

### 3.6 前端与导出影响
- 结果中心
  - 新增“预扣轨迹摘要”区块
  - 展示实际已预扣、规则应预扣、差异额、适用规则模式
- 历史查询
  - 差异对比后续可纳入“预扣差异”维度
- 导出
  - 后续可新增字段：
    - `withholdingModeLabel`
    - `expectedWithheldTaxTotal`
    - `withholdingDifference`

## 4. 涉及模块
- `packages/core/src/annual-tax-calculator.ts`
- `packages/core/src/index.ts`
- `apps/api/src/services/annual-tax-service.ts`
- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/history-query-*`
- `apps/desktop/src/pages/annual-tax-export.ts`

## 5. 数据结构变更
- 首版建议：
  - 不新增数据库表
  - 仅扩展核心计算返回结构
- 二阶段候选：
  - 员工年度级预扣规则参数表
  - 或挂到现有员工 / 上下文配置上的年度参数对象

## 6. 接口变更
- 首版建议不新增单独 API。
- 复用现有年度结果 API，只扩展返回结构中的预扣轨迹摘要。
- 若轨迹过大，再考虑新增：
  - `GET /api/units/:unitId/years/:taxYear/annual-results/:employeeId/withholding-trace`

## 7. 风险评估
- 风险等级：高
- 主要风险：
  - 当前系统的“已预扣税额”是实际值，而规则引擎会产生“应预扣值”，两者容易混淆。
  - 6 万元优化规则和首次取得工资规则都依赖额外上下文，当前数据库没有直接承载。
  - 若一次性把月度预扣轨迹写进现有结果中心，页面复杂度会上升过快。

## 8. 回退方案
- 若规则扩展后产生口径争议，可回退到现有年度汇总算法。
- 因首版建议不改数据库，所以回退成本主要在核心类型和前端展示层。

## 9. 任务拆解
- 任务 1：补预扣预缴规则共享类型与月度轨迹纯函数
- 任务 2：在年度计算器中接入预扣轨迹摘要
- 任务 3：结果中心增加预扣轨迹摘要展示
- 任务 4：导出结构补充预扣规则相关字段

## 10. 外部依据
- 居民个人工资薪金所得预扣预缴采取累计预扣法：
  - [中国政府网：新个人所得税法若干征管衔接问题公告](https://www.gov.cn/fuwu/2018-12/21/content_5350720.htm)
- 上年收入不超过 6 万元的简便优化预扣：
  - [国家税务总局公告 2020 年第 19 号](https://guizhou.chinatax.gov.cn/wjjb/zcfgk/szfl/grsds/202203/t20220312_72950429.html)
- 年度中间首次取得工资薪金所得的累计减除费用规则：
  - [国家税务总局公告 2020 年第 13 号](https://guangxi.chinatax.gov.cn/xwdt/ztzl/lszt/gsgg/zcwj/202206/t20220607_368142.html)
