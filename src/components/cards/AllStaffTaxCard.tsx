import { useMemo, useState } from 'react';
import { GlassCard } from '../common/GlassCard';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { emptyYearMonths } from '../../types';
import { formatYuan } from '../../lib/tax/fen';
import { buildAllStaffTaxTable } from '../../lib/tax/all-staff-table';
import {
  describePayrollTaxDiff,
  formatPayrollDiffCell,
  formatPayrollWithheldCell,
  payrollDiffToneClass,
  payrollTaxDiffYuan,
  sumPayrollTaxDiffs,
} from '../../lib/tax/payroll-tax-diff';

/**
 * 全员预扣汇总：本工作年度所有员工 1–12 月本期应预扣税额明细
 * + 扣缴差异合计（点击查看逐月：工资单扣缴 vs 应预扣）
 */
export function AllStaffTaxCard({ fill = false }: { fill?: boolean }) {
  const employees = useTaxStore((s) => s.employees);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const workspace = useTaxStore((s) => s.workspace);
  const dataEpoch = useTaxStore((s) => s.dataEpoch);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);

  const [drillEmployeeId, setDrillEmployeeId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      Object.values(employees).sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [employees],
  );

  const table = useMemo(() => {
    const built = buildAllStaffTaxTable(list, getEmployeeCalc);
    return {
      rows: built.rows.map((r) => {
        const months = monthlyRecords[r.employeeId] ?? emptyYearMonths();
        const monthlyDiffs = r.monthly.map((due, i) =>
          payrollTaxDiffYuan(months[i]?.payrollTaxWithheld ?? null, due),
        );
        const { sum: diffSum } = sumPayrollTaxDiffs(monthlyDiffs);
        return {
          emp: employees[r.employeeId]!,
          monthly: r.monthly,
          yearTotal: r.yearTotal,
          monthlyDiffs,
          diffSum,
        };
      }),
      colTotals: built.colTotals,
      grandTotal: built.grandTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, dataEpoch, workspace?.year, getEmployeeCalc, employees, monthlyRecords]);

  const staffDiffTotal = useMemo(
    () => sumPayrollTaxDiffs(table.rows.map((r) => r.diffSum)),
    [table.rows],
  );

  const year = workspace?.year ?? new Date().getFullYear();
  const drillRow = drillEmployeeId
    ? table.rows.find((r) => r.emp.id === drillEmployeeId)
    : null;
  const drillMonths = drillEmployeeId
    ? (monthlyRecords[drillEmployeeId] ?? emptyYearMonths())
    : emptyYearMonths();

  return (
    <GlassCard
      title="全员预扣汇总"
      subtitle={`${year} 年度 · 各员工每月本期应预扣税额（元）；右侧为工资单扣缴差异合计`}
      fill={fill}
    >
      {table.rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--text-muted)]">
          暂无员工。请先在花名册中添加员工并录入工资。
        </p>
      ) : (
        <div
          className={`data-table-wrap ${fill ? 'max-h-none' : 'max-h-[28rem]'}`}
        >
          <table className="data-table all-staff-tax-table">
            <thead>
              <tr>
                <th className="sticky-col">姓名</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="text-right!">
                    {i + 1}月
                  </th>
                ))}
                <th className="text-right!">全年合计</th>
                <th className="text-right!">扣缴差异合计</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(
                ({ emp, monthly, yearTotal, diffSum }) => (
                  <tr key={emp.id}>
                    <td className="sticky-col font-medium text-[var(--text)]">
                      {emp.name}
                    </td>
                    {monthly.map((tax, i) => (
                      <td key={i} className="num text-right">
                        {formatYuan(tax)}
                      </td>
                    ))}
                    <td className="num text-right font-semibold text-[var(--text)]">
                      {formatYuan(yearTotal)}
                    </td>
                    <td className="num text-right">
                      <button
                        type="button"
                        className={`payroll-diff-cell-btn ${payrollDiffToneClass(diffSum)}`}
                        title={
                          diffSum == null
                            ? '未录入工资单扣缴；点击可查看明细'
                            : `${describePayrollTaxDiff(diffSum) ?? ''}（点击查看各月）`
                        }
                        onClick={() => setDrillEmployeeId(emp.id)}
                      >
                        {diffSum != null && diffSum > 0 ? '+' : ''}
                        {formatPayrollDiffCell(diffSum)}
                      </button>
                    </td>
                  </tr>
                ),
              )}
              <tr className="all-staff-total-row">
                <td className="sticky-col font-semibold text-[var(--text)]">
                  合计
                </td>
                {table.colTotals.map((t, i) => (
                  <td key={i} className="num text-right font-semibold">
                    {formatYuan(t)}
                  </td>
                ))}
                <td className="num text-right font-semibold text-[var(--primary)]">
                  {formatYuan(table.grandTotal)}
                </td>
                <td
                  className={`num text-right font-semibold ${payrollDiffToneClass(staffDiffTotal.sum)}`}
                >
                  {staffDiffTotal.sum != null && staffDiffTotal.sum > 0
                    ? '+'
                    : ''}
                  {formatPayrollDiffCell(staffDiffTotal.sum)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 mb-0 text-[10px] text-[var(--text-faint)]">
        差异 = 工资单扣缴 − 本期应预扣。正数表示多扣（可未来少扣/退发），负数表示少扣（建议未来扣回）。未录入扣缴显示「—」。点击差异可看逐月明细。
      </p>

      {drillRow && (
        <div
          className="payroll-diff-modal-backdrop"
          role="presentation"
          onClick={() => setDrillEmployeeId(null)}
        >
          <div
            className="payroll-diff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payroll-diff-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="payroll-diff-modal-head">
              <h3 id="payroll-diff-modal-title" className="m-0 text-base font-semibold">
                {drillRow.emp.name} · 工资单扣缴差异（{year}）
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDrillEmployeeId(null)}
              >
                关闭
              </button>
            </div>
            <p className="mt-1 mb-3 text-[11px] text-[var(--text-muted)]">
              写在工资表上的个税实扣与软件应预扣对照；不改变累计预扣计算结果。
            </p>
            <div className="data-table-wrap max-h-[min(24rem,50vh)]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th className="text-right!">本期应预扣</th>
                    <th className="text-right!">工资单扣缴</th>
                    <th className="text-right!">差异</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRow.monthly.map((due, i) => {
                    const withheld =
                      drillMonths[i]?.payrollTaxWithheld ?? null;
                    const diff = drillRow.monthlyDiffs[i] ?? null;
                    return (
                      <tr key={i}>
                        <td className="font-medium">{i + 1}月</td>
                        <td className="num text-right">{formatYuan(due)}</td>
                        <td className="num text-right">
                          {formatPayrollWithheldCell(withheld)}
                        </td>
                        <td
                          className={`num text-right font-medium ${payrollDiffToneClass(diff)}`}
                          title={describePayrollTaxDiff(diff) ?? undefined}
                        >
                          {diff != null && diff > 0 ? '+' : ''}
                          {formatPayrollDiffCell(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {drillRow.diffSum != null && (
              <p
                className={`mt-3 mb-0 text-[12px] ${payrollDiffToneClass(drillRow.diffSum)}`}
              >
                合计差异：
                {drillRow.diffSum > 0 ? '+' : ''}
                {formatYuan(drillRow.diffSum)} ·{' '}
                {describePayrollTaxDiff(drillRow.diffSum)}
              </p>
            )}
            {drillRow.diffSum == null && (
              <p className="mt-3 mb-0 text-[11px] text-[var(--text-faint)]">
                尚未录入任何月份的工资单扣缴。请在「个人月工资」中填写。
              </p>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
