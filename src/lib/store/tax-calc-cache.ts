/**
 * 按员工缓存累计预扣结果；仅当该员工 revision / 税年变化时重算
 */

import type { Employee, MonthCalcResult, MonthInput } from '../../types';
import { emptyYearMonths } from '../../types';
import { resolveTaxYearEmployment } from '../utils/date';
import { computeMonthlyPrewithhold } from '../tax/engine';

export type CalcInput = {
  employee: Employee;
  months: MonthInput[];
  taxYear: number;
  revision: number;
};

export interface TaxCalcCache {
  getOrCompute(id: string, input: CalcInput): MonthCalcResult[];
  invalidate(id: string): void;
  clear(): void;
  /** 测试：某员工真实调用引擎次数 */
  getInvokeCount(id: string): number;
  resetInvokeCounts(): void;
}

export function createTaxCalcCache(): TaxCalcCache {
  type Entry = {
    revision: number;
    taxYear: number;
    result: MonthCalcResult[];
  };
  const cache = new Map<string, Entry>();
  const invokeCounts = new Map<string, number>();

  return {
    getOrCompute(id, input) {
      const hit = cache.get(id);
      if (
        hit &&
        hit.revision === input.revision &&
        hit.taxYear === input.taxYear
      ) {
        return hit.result;
      }
      invokeCounts.set(id, (invokeCounts.get(id) ?? 0) + 1);
      const emp = input.employee;
      const empScope = resolveTaxYearEmployment(
        emp.hireDate,
        emp.leaveDate,
        input.taxYear,
        emp.isFirstTime,
      );
      const months =
        input.months?.length === 12 ? input.months : emptyYearMonths();
      const result = computeMonthlyPrewithhold({
        hireMonth: empScope.hireMonth,
        leaveMonth: empScope.leaveMonth,
        isFirstTime: empScope.isFirstTime,
        months,
      });
      cache.set(id, {
        revision: input.revision,
        taxYear: input.taxYear,
        result,
      });
      return result;
    },
    invalidate(id) {
      cache.delete(id);
    },
    clear() {
      cache.clear();
    },
    getInvokeCount(id) {
      return invokeCounts.get(id) ?? 0;
    },
    resetInvokeCounts() {
      invokeCounts.clear();
    },
  };
}
