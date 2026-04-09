import type { EmployeeYearEntryOverview } from "@dude-tax/core";

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
    <div className="workspace-overlay">
      <div className="workspace-dialog employee-selection-dialog">
        <div className="workspace-header">
          <div>
            <h2>选择员工</h2>
            <p>默认纳入本年全部有效员工，可按需取消勾选后重新计算。</p>
          </div>
          <div className="button-row compact">
            <button className="ghost-button" type="button" onClick={onSelectAll}>
              全选全部有效员工
            </button>
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
};
