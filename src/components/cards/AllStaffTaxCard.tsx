import { useMemo } from 'react';
import { GlassCard } from '../common/GlassCard';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { formatYuan } from '../../lib/tax/fen';

/**
 * 全员预扣汇总：本工作年度所有员工 1–12 月本期应预扣税额明细
 */
export function AllStaffTaxCard({ fill = false }: { fill?: boolean }) {
  const employees = useTaxStore((s) => s.employees);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const workspace = useTaxStore((s) => s.workspace);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);

  const list = useMemo(
    () => Object.values(employees).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [employees],
  );

  // 任一员工档案或月度数据变化时重算
  const depKey = useMemo(
    () =>
      JSON.stringify({
        e: list.map((e) => ({
          id: e.id,
          h: e.hireDate,
          l: e.leaveDate,
          f: e.isFirstTime,
        })),
        m: monthlyRecords,
        y: workspace?.year,
      }),
    [list, monthlyRecords, workspace?.year],
  );

  const table = useMemo(() => {
    const rows = list.map((emp) => {
      const calc = getEmployeeCalc(emp.id);
      const monthly = Array.from({ length: 12 }, (_, i) => calc[i]?.thisMonthTax ?? 0);
      const yearTotal = monthly.reduce((s, v) => s + v, 0);
      return { emp, monthly, yearTotal };
    });
    const colTotals = Array.from({ length: 12 }, (_, i) =>
      rows.reduce((s, r) => s + r.monthly[i]!, 0),
    );
    const grandTotal = colTotals.reduce((s, v) => s + v, 0);
    return { rows, colTotals, grandTotal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, getEmployeeCalc, list]);

  const year = workspace?.year ?? new Date().getFullYear();

  return (
    <GlassCard
      title="全员预扣汇总"
      subtitle={`${year} 年度 · 各员工每月本期应预扣税额（元）`}
      fill={fill}
    >
      {table.rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--text-muted)]">
          暂无员工。请先在花名册中添加员工并录入工资。
        </p>
      ) : (
        <div className={`data-table-wrap ${fill ? 'max-h-none' : 'max-h-[28rem]'}`}>
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
              </tr>
            </thead>
            <tbody>
              {table.rows.map(({ emp, monthly, yearTotal }) => (
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
                </tr>
              ))}
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
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
