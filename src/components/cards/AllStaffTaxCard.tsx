import { useMemo } from 'react';
import { GlassCard } from '../common/GlassCard';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { formatYuan } from '../../lib/tax/fen';
import { buildAllStaffTaxTable } from '../../lib/tax/all-staff-table';

/**
 * 全员预扣汇总：本工作年度所有员工 1–12 月本期应预扣税额明细
 * 依赖 dataEpoch（O(1)）而非 JSON.stringify 全量 monthlyRecords
 */
export function AllStaffTaxCard({ fill = false }: { fill?: boolean }) {
  const employees = useTaxStore((s) => s.employees);
  const workspace = useTaxStore((s) => s.workspace);
  const dataEpoch = useTaxStore((s) => s.dataEpoch);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);

  const list = useMemo(
    () =>
      Object.values(employees).sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [employees],
  );

  // dataEpoch：任意员工变更时递增；计税走 per-id 缓存，未改员工不重算引擎
  const table = useMemo(() => {
    const built = buildAllStaffTaxTable(list, getEmployeeCalc);
    return {
      rows: built.rows.map((r) => ({
        emp: employees[r.employeeId]!,
        monthly: r.monthly,
        yearTotal: r.yearTotal,
      })),
      colTotals: built.colTotals,
      grandTotal: built.grandTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, dataEpoch, workspace?.year, getEmployeeCalc, employees]);

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
