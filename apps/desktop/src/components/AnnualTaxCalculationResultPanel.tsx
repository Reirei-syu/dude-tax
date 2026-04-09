import type { AnnualTaxCalculation, BonusTaxBracket } from "@dude-tax/core";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { buildQuickCalculateTraceDisplayRows } from "../pages/quick-calculate-results";

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type Props = {
  result: AnnualTaxCalculation;
  bonusTaxBrackets?: BonusTaxBracket[];
};

export const AnnualTaxCalculationResultPanel = ({
  result,
  bonusTaxBrackets = [],
}: Props) => {
  const selectedSchemeResult =
    result.selectedScheme === "separate_bonus"
      ? result.schemeResults.separateBonus
      : result.schemeResults.combinedBonus;
  const alternativeSchemeResult =
    result.selectedScheme === "separate_bonus"
      ? result.schemeResults.combinedBonus
      : result.schemeResults.separateBonus;
  const selectedBonusRate =
    result.selectedScheme === "separate_bonus" && selectedSchemeResult.bonusBracketLevel
      ? bonusTaxBrackets.find(
          (bracket) => bracket.level === selectedSchemeResult.bonusBracketLevel,
        )?.rate ?? null
      : null;

  return (
    <>
      <div className="summary-grid results-summary-grid">
        <div className="summary-card">
          <span>采用方案</span>
          <strong>{taxCalculationSchemeLabelMap[result.selectedScheme]}</strong>
          <small className="summary-card-secondary">
            另一方案年累计应交税额：{formatCurrency(alternativeSchemeResult.finalTax)}
          </small>
        </div>
        <div className="summary-card">
          <span>年度应纳税额</span>
          <strong>{formatCurrency(result.annualTaxPayable)}</strong>
        </div>
        <div className="summary-card">
          <span>全年已预扣税额</span>
          <strong>{formatCurrency(result.annualTaxWithheld)}</strong>
        </div>
        <div className="summary-card">
          <span>应补 / 应退</span>
          <strong>{formatCurrency(result.annualTaxSettlement)}</strong>
        </div>
        {result.selectedScheme === "separate_bonus" ? (
          <div className="summary-card">
            <span>年终奖应扣税额</span>
            <strong>{formatCurrency(selectedSchemeResult.annualBonusTax)}</strong>
          </div>
        ) : null}
        {result.selectedScheme === "separate_bonus" ? (
          <div className="summary-card">
            <span>年终奖适用税率</span>
            <strong>{selectedBonusRate === null ? "-" : `${selectedBonusRate}%`}</strong>
          </div>
        ) : null}
      </div>

      <table className="data-table month-entry-overview-table">
        <thead>
          <tr>
            <th>月份</th>
            <th>本月应预扣额</th>
            <th>本月累计应预扣额</th>
            <th>累计已预扣额</th>
            <th>适用税率</th>
          </tr>
        </thead>
        <tbody>
          {buildQuickCalculateTraceDisplayRows(result.withholdingTraceItems ?? []).map((item) => (
            <tr key={item.taxMonth}>
              <td>{item.taxMonth} 月</td>
              <td>{formatCurrency(item.currentMonthPayableTax)}</td>
              <td>{formatCurrency(item.cumulativePayableTax)}</td>
              <td>{formatCurrency(item.cumulativeWithheldTax)}</td>
              <td>{item.appliedRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
