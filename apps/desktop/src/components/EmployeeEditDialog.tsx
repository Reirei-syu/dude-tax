import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  primaryActionLabel: string;
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

export const EmployeeEditDialog = ({
  open,
  title,
  description,
  primaryActionLabel,
  submitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
  children,
}: Props) => {
  if (!open) {
    return null;
  }

  return (
    <div className="workspace-overlay">
      <div
        aria-modal="true"
        className="workspace-dialog employee-selection-dialog"
        role="dialog"
      >
        <div className="workspace-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="button-row compact">
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        {children}

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        <div className="button-row">
          <button
            className="primary-button"
            disabled={submitting}
            type="button"
            onClick={onSubmit}
          >
            {primaryActionLabel}
          </button>
          <button className="ghost-button" disabled={submitting} type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
