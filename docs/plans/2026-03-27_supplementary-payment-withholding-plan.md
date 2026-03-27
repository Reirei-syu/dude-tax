# 补发补扣场景方案

## 1. 背景
- 当前个税计算核心已具备年度汇算、月度预扣轨迹纯函数和年度预扣轨迹摘要。
- 现有 `EmployeeMonthRecord` 仍是“按月聚合”的单记录结构，无法清晰表达补发补扣来源、支付月份和是否属于往期更正。
- `PENDING_GOALS.md` 中仍存在未完成项：`个税计算核心增强 -> 补发补扣场景`。

## 2. 目标
- 明确补发补扣与正常工资的建模边界。
- 区分“本月实际发放的补发补扣”与“往期申报错误后的更正申报”两类场景。
- 为后续算法和 UI 实施拆出可渐进落地的任务。

## 3. 设计方案

### 3.1 场景拆分
- 场景 A：本月正常工资
  - 继续按当前 `salaryIncome`、`withheldTax` 链路处理。
- 场景 B：本月实际发放的补发 / 补扣
  - 作为“支付当月”的收入或税款调整进入当月预扣轨迹。
  - 不回写到历史月份，不触发往期逐月更正。
- 场景 C：往期申报错误后的更正申报
  - 本质上不是“补发补扣字段”，而是“更正历史税款所属期并联动后续月份”的流程问题。
  - 不建议先塞进当前月度记录字段里混做一条数据。

### 3.2 首版建议
- 首版只支持场景 B，不直接做场景 C。
- 原因：
  - 场景 B 是财务最常见的“本月补发工资 / 本月补扣税款”。
  - 场景 C 需要更正历史税款所属期，并对后续月份逐月重算，复杂度高很多。

### 3.3 数据模型建议
- 在当前 `employee_month_records` 上做最小扩展：
  - `supplementarySalaryIncome`
  - `supplementaryWithheldTaxAdjustment`
  - `supplementarySourcePeriodLabel`
  - `supplementaryRemark`
- 解释：
  - `supplementarySalaryIncome`：本月实际补发进入本月预扣的工资金额
  - `supplementaryWithheldTaxAdjustment`：本月实际补扣 / 补退形成的预扣税调整额，可正可负
  - `supplementarySourcePeriodLabel`：来源说明，如 `2026-03`、`2025 年绩效差额`
  - `supplementaryRemark`：补发补扣备注

### 3.4 计算口径建议
- 年度汇算口径
  - `salaryIncomeTotal` 应包含补发工资收入。
  - `annualTaxWithheld` 应包含补扣 / 补退后的实际预扣税额调整。
- 月度预扣轨迹口径
  - `salaryIncome + supplementarySalaryIncome` 作为支付当月计税收入。
  - `actualWithheldTax` 应叠加 `supplementaryWithheldTaxAdjustment`。
  - `supplementarySourcePeriodLabel` 只作为说明字段，不改变税款所属期。

### 3.5 暂不处理的边界
- 不支持“把某笔补发拆回历史工资所属月”。
- 不支持“自然人扣缴端往期更正后自动联动后续月份”的申报流。
- 不支持跨单位补发与跨年历史所属的复杂归属自动判定。

### 3.6 UI 建议
- 月度录入页
  - 在当前月份表单中新增“补发补扣”区块
  - 明确提示：这里只记录“本月实际发放 / 调整”的金额，不是往期更正申报
- 结果中心
  - 后续在预扣轨迹摘要中补充“含补发补扣月份数”或“补发来源说明”
- 历史查询 / 导出
  - 后续补充补发补扣相关字段导出

## 4. 涉及模块
- `packages/core`
- `apps/api/src/repositories`
- `apps/api/src/routes`
- `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/history-query-*`

## 5. 数据结构变更
- 候选扩展字段：
  - `supplementary_salary_income`
  - `supplementary_withheld_tax_adjustment`
  - `supplementary_source_period_label`
  - `supplementary_remark`
- 首版不新增新表，继续沿用当前月度记录表。
- 若后续需要支持多笔补发明细，再考虑单独拆 `employee_month_adjustments` 明细表。

## 6. 接口变更
- 首版候选：
  - 扩展月度记录读写接口字段
  - 扩展年度结果和导出预览结构中的补发补扣摘要字段
- 暂不新增单独 API。

## 7. 风险评估
- 风险等级：高
- 主要风险：
  - 用户容易把“本月补发”与“往期更正申报”混淆。
  - 当前月度记录是聚合表，若未来需要多笔补发明细，扩展空间有限。
  - 补扣税调整允许负数，会影响现有字段校验和 UI 输入约束。

## 8. 回退方案
- 首版若出现口径争议，可回退到“不支持补发补扣字段”的旧逻辑。
- 由于建议先做当前表扩展，不建新表，回退成本可控。

## 9. 任务拆解
- 任务 1：月度记录补发补扣字段与共享类型
- 任务 2：预扣轨迹算法并入补发补扣金额
- 任务 3：月度录入页新增补发补扣区块与校验
- 任务 4：结果中心 / 导出联动补发补扣摘要

## 10. 外部依据
- 工资税款所属期按“实际发放日期所属月份”处理：
  - [国家税务总局安徽省税务局 12366 热点问答（2025年1月）](https://anhui.chinatax.gov.cn/art/2025/2/24/art_9438_1234145.html)
- 往期工资薪金申报错误需要更正历史所属期，并联动后续月份逐月更正：
  - [国家税务总局深圳市税务局：往期申报错误更正指引](https://shenzhen.chinatax.gov.cn/sztax/zcwj/rdwd/202408/21eb45f0b9aa4fe8bcbbe1ab020853b4.shtml)
- 累计预扣法和年度中间首次取得工资规则仍沿用此前方案的官方依据：
  - [中国政府网：新个人所得税法若干征管衔接问题公告](https://www.gov.cn/fuwu/2018-12/21/content_5350720.htm)
  - [国家税务总局公告 2020 年第 13 号](https://www.chinatax.gov.cn/chinatax/n810341/n810765/c101653/202007/c5156589/content.html)
