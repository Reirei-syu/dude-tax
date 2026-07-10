import { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { ChineseDateInput } from '../common/ChineseDateInput';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { resolveTaxYearEmployment } from '../../lib/utils/date';

export function EmployeeRosterCard({ fill = false }: { fill?: boolean }) {
  const employees = useTaxStore((s) => s.employees);
  const selected = useTaxStore((s) => s.selectedEmployeeId);
  const selectEmployee = useTaxStore((s) => s.selectEmployee);
  const addEmployee = useTaxStore((s) => s.addEmployee);
  const removeEmployee = useTaxStore((s) => s.removeEmployee);
  const setHireDate = useTaxStore((s) => s.setHireDate);
  const setLeaveDate = useTaxStore((s) => s.setLeaveDate);
  const setIsFirstTime = useTaxStore((s) => s.setIsFirstTime);
  const workspace = useTaxStore((s) => s.workspace);
  const [name, setName] = useState('');

  const list = Object.values(employees);
  const yearHint = workspace?.year ?? new Date().getFullYear();

  return (
    <GlassCard
      title="员工花名册"
      subtitle="选择员工以编辑工资与年终奖"
      fill={fill}
    >
      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新员工姓名"
          className="field min-w-0 flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              addEmployee(name.trim() || '新员工');
              setName('');
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            addEmployee(name.trim() || '新员工');
            setName('');
          }}
        >
          <UserPlus size={14} /> 添加
        </button>
      </div>

      <div className={`data-table-wrap ${fill ? 'max-h-none' : 'max-h-64'}`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>入职日期</th>
              <th>离职日期</th>
              <th className="text-center!" title="仅当年度入职员工需要">
                首次
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((emp) => {
              const scope = resolveTaxYearEmployment(
                emp.hireDate,
                emp.leaveDate,
                yearHint,
                emp.isFirstTime,
              );
              return (
              <tr
                key={emp.id}
                onClick={() => selectEmployee(emp.id)}
                className={`cursor-pointer ${selected === emp.id ? 'is-selected' : ''}`}
              >
                <td className="font-medium text-[var(--text)]">{emp.name}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <ChineseDateInput
                    value={emp.hireDate}
                    yearHint={yearHint}
                    ariaLabel={`${emp.name}入职日期`}
                    onChange={(iso) => {
                      if (iso) setHireDate(emp.id, iso);
                    }}
                  />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <ChineseDateInput
                    value={emp.leaveDate}
                    yearHint={yearHint}
                    allowEmpty
                    ariaLabel={`${emp.name}离职日期`}
                    onChange={(iso) => setLeaveDate(emp.id, iso)}
                  />
                </td>
                <td
                  className="text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {scope.showFirstTimeOption ? (
                    <input
                      type="checkbox"
                      checked={emp.isFirstTime}
                      title="仅当年度入职可用。勾选：5000 从 1 月起算；不勾选：从入职月起算"
                      className="accent-[var(--primary)]"
                      onChange={(e) =>
                        setIsFirstTime(emp.id, e.target.checked)
                      }
                    />
                  ) : (
                    <span
                      className="text-[10px] text-[var(--text-faint)]"
                      title="往年已入职：本税年自动从 1 月起算减除，无需勾选"
                    >
                      —
                    </span>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`删除 ${emp.name}`}
                    onClick={() => removeEmployee(emp.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8! text-center text-xs text-[var(--text-muted)]"
                >
                  暂无员工，请先添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
