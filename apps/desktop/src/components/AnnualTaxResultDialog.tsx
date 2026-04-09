import type { AnnualTaxCalculation, BonusTaxBracket } from "@dude-tax/core";
import { AnnualTaxCalculationResultPanel } from "./AnnualTaxCalculationResultPanel";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  result: AnnualTaxCalculation | null;
  bonusTaxBrackets?: BonusTaxBracket[];
  onClose: () => void;
};

export const AnnualTaxResultDialog = ({
  open,
  title,
  subtitle,
  result,
  bonusTaxBrackets = [],
  onClose,
}: Props) => {
  if (!open || !result) {
    return null;
  }

  return (
    <div className="workspace-overlay">
      <div className="workspace-dialog annual-tax-result-dialog">
        <div className="workspace-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="button-row compact">
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="workspace-table-wrapper annual-tax-result-wrapper">
          <div className="annual-tax-result-content">
            <AnnualTaxCalculationResultPanel
              result={result}
              bonusTaxBrackets={bonusTaxBrackets}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
