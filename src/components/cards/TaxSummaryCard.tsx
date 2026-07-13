import { useMemo } from 'react';
import { GlassCard } from '../common/GlassCard';
import { EmployeeCombobox } from '../common/EmployeeCombobox';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { emptyYearMonths } from '../../types';
import { formatYuan } from '../../lib/tax/fen';
import {
  describePayrollTaxDiff,
  formatPayrollDiffCell,
  formatPayrollWithheldCell,
  payrollDiffToneClass,
  payrollTaxDiffYuan,
  sumPayrollTaxDiffs,
} from '../../lib/tax/payroll-tax-diff';

export function TaxSummaryCard({ fill = false }: { fill?: boolean }) {
  const selectedId = useTaxStore((s) => s.selectedEmployeeId);
  const employees = useTaxStore((s) => s.employees);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);
  const dataEpoch = useTaxStore((s) => s.dataEpoch);

  const employeeCount = Object.keys(employees).length;
  const emp = selectedId ? employees[selectedId] : null;
  const recordsKey = selectedId
    ? JSON.stringify(monthlyRecords[selectedId])
    : '';
  const firstTime = emp?.isFirstTime;
  const hire = emp?.hireDate;
  const leave = emp?.leaveDate;

  const rows = useMemo(() => {
    if (!selectedId) return [];
    return getEmployeeCalc(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, recordsKey, firstTime, hire, leave, getEmployeeCalc]);

  const months = selectedId
    ? (monthlyRecords[selectedId] ?? emptyYearMonths())
    : emptyYearMonths();

  const diffRows = useMemo(() => {
    return rows.map((r) => {
      const withheld = months[r.month - 1]?.payrollTaxWithheld ?? null;
      const diff = payrollTaxDiffYuan(withheld, r.thisMonthTax);
      return { withheld, diff };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, recordsKey, dataEpoch]);

  const yearDiff = useMemo(
    () => sumPayrollTaxDiffs(diffRows.map((d) => d.diff)),
    [diffRows],
  );
  const yearDiffHint = describePayrollTaxDiff(yearDiff.sum);

  const employeeSelector = <EmployeeCombobox label="查看员工" />;

  if (employeeCount === 0) {
    return (
      <GlassCard title="预扣税额汇总" fill={fill}>
        {employeeSelector}
        <p className="m-0 text-sm text-[var(--text-muted)]">
          请先在「员工花名册」中添加员工。
        </p>
      </GlassCard>
    );
  }

  if (!emp) {
    return (
      <GlassCard title="预扣税额汇总" fill={fill}>
        {employeeSelector}
        <p className="m-0 text-sm text-[var(--text-muted)]">
          请从上方搜索或选择员工，查看 12 个月预扣税额。
        </p>
      </GlassCard>
    );
  }

  const total = rows[11]?.cumTax ?? 0;
  const maxTax = Math.max(...rows.map((r) => r.thisMonthTax), 1);

  return (
    <GlassCard
      title="预扣税额汇总"
      subtitle={`${emp.name} · 全年累计预扣约 ${formatYuan(total)} 元${
        yearDiff.sum != null
          ? ` · 扣缴差异合计 ${yearDiff.sum > 0 ? '+' : ''}${formatYuan(yearDiff.sum)}`
          : ''
      }`}
      fill={fill}
    >
      {employeeSelector}
      <div className="mb-3 flex h-16 items-end gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-2">
        {rows.map((r) => (
          <div
            key={r.month}
            className="flex-1 rounded-t-sm transition-all"
            title={`${r.month}月: ${formatYuan(r.thisMonthTax)}`}
            style={{
              height: `${Math.max(4, (r.thisMonthTax / maxTax) * 100)}%`,
              background:
                'linear-gradient(180deg, #818cf8 0%, var(--primary) 100%)',
              opacity: 0.9,
            }}
          />
        ))}
      </div>
      <div className={`data-table-wrap ${fill ? 'max-h-none' : 'max-h-56'}`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>月份</th>
              <th className="text-right!">工资</th>
              <th className="text-right!">累计应纳税所得</th>
              <th className="text-right!">税率</th>
              <th className="text-right!">本期预扣</th>
              <th className="text-right!">工资单扣缴</th>
              <th className="text-right!">差异</th>
              <th className="text-right!">累计预扣</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const { withheld, diff } = diffRows[i] ?? {
                withheld: null,
                diff: null,
              };
              return (
                <tr key={r.month}>
                  <td className="font-medium text-[var(--text)]">{r.month}月</td>
                  <td className="num text-right">{formatYuan(r.salary)}</td>
                  <td className="num text-right">{formatYuan(r.cumTaxable)}</td>
                  <td className="num text-right text-[var(--text-muted)]">
                    {(r.rate * 100).toFixed(0)}%
                  </td>
                  <td className="num text-right font-semibold text-[var(--text)]">
                    {formatYuan(r.thisMonthTax)}
                  </td>
                  <td className="num text-right text-[var(--text-muted)]">
                    {formatPayrollWithheldCell(withheld)}
                  </td>
                  <td
                    className={`num text-right font-medium ${payrollDiffToneClass(diff)}`}
                    title={describePayrollTaxDiff(diff) ?? undefined}
                  >
                    {diff != null && diff > 0 ? '+' : ''}
                    {formatPayrollDiffCell(diff)}
                  </td>
                  <td className="num text-right">{formatYuan(r.cumTax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {yearDiffHint != null && (
        <p
          className={`mt-2 mb-0 text-[11px] leading-relaxed ${payrollDiffToneClass(yearDiff.sum)}`}
        >
          已录入 {yearDiff.monthsWithData} 个月工资单扣缴 · 差异合计
          （扣缴 − 应预扣）{yearDiff.sum! > 0 ? '+' : ''}
          {formatYuan(yearDiff.sum!)} · {yearDiffHint}
        </p>
      )}
      {yearDiff.sum == null && (
        <p className="mt-2 mb-0 text-[10px] text-[var(--text-faint)]">
          在「个人月工资」中录入「工资单个税扣缴」后，此处显示与本期应预扣的差异（正数=多扣，负数=少扣）。
        </p>
      )}
    </GlassCard>
  );
}
