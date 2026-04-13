import type { ReactNode } from "react";
import { FloatingWorkspaceDialog } from "./FloatingWorkspaceDialog";

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
    <FloatingWorkspaceDialog
      open={open}
      scope="dialog:employee-edit"
      title={title}
      subtitle={description}
      defaultLayout={{
        x: 120,
        y: 72,
        width: 960,
        height: 760,
        isMaximized: false,
      }}
      onClose={onClose}
      className="employee-selection-dialog"
      footer={
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
      }
    >
      <>
        {children}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </>
    </FloatingWorkspaceDialog>
  );
};
