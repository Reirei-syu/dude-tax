import type { EmployeeYearEntryOverview } from "@dude-tax/core";
import { FloatingWorkspaceDialog } from "./FloatingWorkspaceDialog";

type Props = {
  open: boolean;
  employees: EmployeeYearEntryOverview[];
  selectedEmployeeIds: number[];
  onClose: () => void;
  onToggleEmployee: (employeeId: number) => void;
  onSelectAll: () => void;
};

const groupConfig = [
  {
    key: "active",
    title: "在职员工",
  },
  {
    key: "left_this_year",
    title: "本年离职员工",
  },
] as const;

export const YearEntryEmployeeSelectionDialog = ({
  open,
  employees,
  selectedEmployeeIds,
  onClose,
  onToggleEmployee,
  onSelectAll,
}: Props) => {
  if (!open) {
    return null;
  }

  const selectedEmployeeIdSet = new Set(selectedEmployeeIds);

  return (
    <FloatingWorkspaceDialog
      open={open}
      scope="dialog:year-entry-selection"
      title="选择员工"
      subtitle="默认纳入本年全部有效员工，可按需取消勾选后重新计算。"
      defaultLayout={{
        x: 140,
        y: 72,
        width: 960,
        height: 760,
        isMaximized: false,
      }}
      onClose={onClose}
      className="employee-selection-dialog"
      headerActions={
        <button className="ghost-button" type="button" onClick={onSelectAll}>
          全选全部有效员工
        </button>
      }
    >
      <>
        <div className="employee-selection-groups">
          {groupConfig.map((group) => {
            const groupEmployees = employees.filter(
              (employee) => employee.employeeGroup === group.key,
            );

            return (
              <section className="employee-selection-group" key={group.key}>
                <div className="section-header">
                  <div>
                    <h3>{group.title}</h3>
                    <p>共 {groupEmployees.length} 人</p>
                  </div>
                </div>

                {groupEmployees.length ? (
                  <div className="employee-checkbox-list">
                    {groupEmployees.map((employee) => (
                      <label className="employee-checkbox-item" key={employee.employeeId}>
                        <input
                          checked={selectedEmployeeIdSet.has(employee.employeeId)}
                          type="checkbox"
                          onChange={() => onToggleEmployee(employee.employeeId)}
                        />
                        <div>
                          <strong>
                            {employee.employeeName}（{employee.employeeCode}）
                          </strong>
                          <p>
                            已录入 {employee.recordedMonthCount} 个月
                            {employee.leaveDate ? ` / 离职：${employee.leaveDate}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">当前分组暂无员工。</div>
                )}
              </section>
            );
          })}
        </div>
      </>
    </FloatingWorkspaceDialog>
  );
};
