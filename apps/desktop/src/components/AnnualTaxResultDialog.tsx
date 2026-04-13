import type { AnnualTaxCalculation, BonusTaxBracket } from "@dude-tax/core";
import { AnnualTaxCalculationResultPanel } from "./AnnualTaxCalculationResultPanel";
import { FloatingWorkspaceDialog } from "./FloatingWorkspaceDialog";

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
    <FloatingWorkspaceDialog
      open={open}
      scope="dialog:annual-tax-result"
      title={title}
      subtitle={subtitle}
      defaultLayout={{
        x: 64,
        y: 40,
        width: 1180,
        height: 860,
        isMaximized: false,
      }}
      onClose={onClose}
      className="annual-tax-result-dialog"
    >
      <>
        <div className="workspace-table-wrapper annual-tax-result-wrapper">
          <div className="annual-tax-result-content">
            <AnnualTaxCalculationResultPanel
              result={result}
              bonusTaxBrackets={bonusTaxBrackets}
            />
          </div>
        </div>
      </>
    </FloatingWorkspaceDialog>
  );
};
