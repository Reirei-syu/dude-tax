type Props = {
  open: boolean;
  title: string;
  description: string;
  beforeHireMonths: number[];
  afterLeaveMonths: number[];
  confirmLabel: string;
  skipLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
};

const formatMonths = (months: number[]) => months.map((month) => `${month} 月`).join("、");

export const EmploymentIncomeConflictDialog = ({
  open,
  title,
  description,
  beforeHireMonths,
  afterLeaveMonths,
  confirmLabel,
  skipLabel,
  cancelLabel,
  onConfirm,
  onSkip,
  onCancel,
}: Props) => {
  if (!open) {
    return null;
  }

  return (
    <div className="workspace-overlay">
      <div className="workspace-dialog employee-selection-dialog">
        <div className="workspace-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>

        <div className="employee-selection-groups">
          {beforeHireMonths.length ? (
            <section className="employee-selection-group">
              <div className="section-header">
                <div>
                  <h3>入职前收入月份</h3>
                  <p>{formatMonths(beforeHireMonths)}</p>
                </div>
              </div>
            </section>
          ) : null}
          {afterLeaveMonths.length ? (
            <section className="employee-selection-group">
              <div className="section-header">
                <div>
                  <h3>离职后收入月份</h3>
                  <p>{formatMonths(afterLeaveMonths)}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="ghost-button" type="button" onClick={onSkip}>
            {skipLabel}
          </button>
          <button className="ghost-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
