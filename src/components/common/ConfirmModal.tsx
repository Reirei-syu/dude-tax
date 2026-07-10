import { useTaxStore } from '../../lib/store/useTaxStore';
import { formatChineseDate } from '../../lib/utils/date';

/** 入职/离职确认弹窗 */
export function ConfirmModal() {
  const pending = useTaxStore((s) => s.pendingConfirm);
  const employees = useTaxStore((s) => s.employees);
  const confirm = useTaxStore((s) => s.confirmPendingAction);
  const cancel = useTaxStore((s) => s.cancelPendingAction);

  if (!pending) return null;

  const name = employees[pending.employeeId]?.name ?? '该员工';
  const isLeave = pending.type === 'leave';
  const title = isLeave ? '确认离职处理' : '确认入职处理';
  const message = isLeave
    ? pending.targetMonth >= 12
      ? `你确认 ${name} 于 12 月离职吗？确认后仅更新离职日期（无后续月份需清零；年终奖仍可正常录入）。`
      : `你确认 ${name} 从 ${pending.targetMonth} 月起不再发放工资吗？确认后 ${pending.targetMonth + 1}–12 月工资与扣除将自动清零（年终奖仍可正常录入）。`
    : pending.targetMonth <= 1
      ? `你确认 ${name} 于 1 月入职吗？确认后将写入入职日期（无更早月份需清零）。`
      : `你确认 ${name} 于 ${pending.targetMonth} 月入职吗？确认后 1–${pending.targetMonth - 1} 月工资与扣除将自动清零。`;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="modal-panel max-w-md">
        <div className="modal-header">
          <h2 id="confirm-title" className="panel-title">
            {title}
          </h2>
        </div>
        <div className="modal-body">
          <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
            {message}
          </p>
          <p className="mt-3 mb-0 text-xs text-[var(--text-muted)]">
            拟定日期：
            <span className="ml-1 font-medium text-[var(--text)]">
              {formatChineseDate(pending.proposedDate)}
            </span>
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={cancel}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
