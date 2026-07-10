/**
 * 全员预扣表聚合（纯函数，避免 UI 内 JSON.stringify 全量 monthlyRecords）
 */

import type { Employee, MonthCalcResult } from '../../types';

export interface AllStaffTaxRow {
  employeeId: string;
  name: string;
  monthly: number[];
  yearTotal: number;
}

export interface AllStaffTaxTable {
  rows: AllStaffTaxRow[];
  colTotals: number[];
  grandTotal: number;
}

/**
 * @param list 已排序的员工列表
 * @param getCalc 单员工计税（应带缓存）
 */
export function buildAllStaffTaxTable(
  list: Employee[],
  getCalc: (employeeId: string) => MonthCalcResult[],
): AllStaffTaxTable {
  const rows: AllStaffTaxRow[] = list.map((emp) => {
    const calc = getCalc(emp.id);
    const monthly = Array.from(
      { length: 12 },
      (_, i) => calc[i]?.thisMonthTax ?? 0,
    );
    const yearTotal = monthly.reduce((s, v) => s + v, 0);
    return {
      employeeId: emp.id,
      name: emp.name,
      monthly,
      yearTotal,
    };
  });
  const colTotals = Array.from({ length: 12 }, (_, i) =>
    rows.reduce((s, r) => s + r.monthly[i]!, 0),
  );
  const grandTotal = colTotals.reduce((s, v) => s + v, 0);
  return { rows, colTotals, grandTotal };
}
