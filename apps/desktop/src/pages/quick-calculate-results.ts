import type { AnnualTaxWithholdingTraceItem } from "@dude-tax/core";

export type QuickCalculateTraceDisplayRow = {
  taxMonth: number;
  currentMonthPayableTax: number;
  cumulativePayableTax: number;
  cumulativeWithheldTax: number;
  appliedRate: number;
};

export const buildQuickCalculateTraceDisplayRows = (
  items: AnnualTaxWithholdingTraceItem[],
): QuickCalculateTraceDisplayRow[] =>
  items.map((item, index) => {
    const previousCumulativePayableTax =
      index === 0 ? 0 : (items[index - 1]?.cumulativeExpectedWithheldTax ?? 0);

    return {
      taxMonth: item.taxMonth,
      currentMonthPayableTax:
        item.cumulativeExpectedWithheldTax - previousCumulativePayableTax,
      cumulativePayableTax: item.cumulativeExpectedWithheldTax,
      cumulativeWithheldTax: previousCumulativePayableTax,
      appliedRate: item.appliedRate,
    };
  });
