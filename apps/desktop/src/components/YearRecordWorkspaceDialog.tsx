import type { YearRecordUpsertItem } from "@dude-tax/core";
import { useMemo } from "react";
import { FloatingWorkspaceDialog } from "./FloatingWorkspaceDialog";
import {
  YEAR_RECORD_DEDUCTION_FIELDS,
  YEAR_RECORD_INCOME_TEXT_FIELDS,
  YEAR_RECORD_TEXT_FIELDS,
  getVisibleYearRecordIncomeFields,
  type YearRecordFieldKey,
} from "../pages/year-record-workspace";

type EditableFieldKey = keyof YearRecordUpsertItem;

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: YearRecordUpsertItem[];
  selectedMonth: number;
  lockedMonths?: number[];
  basicDeductionAmount: number;
  readOnly?: boolean;
  hiddenFieldKeys?: YearRecordFieldKey[];
  onClose: () => void;
  onSelectMonth: (taxMonth: number) => void;
  onChangeRow?: (
    taxMonth: number,
    key: EditableFieldKey,
    value: string | number,
  ) => void;
  onApplyToNextMonth?: () => void;
  onApplyToFutureMonths?: () => void;
  primaryActionLabel?: string;
  primaryActionDisabled?: boolean;
  onPrimaryAction?: () => void;
};

export const YearRecordWorkspaceDialog = ({
  open,
  title,
  subtitle,
  rows,
  selectedMonth,
  lockedMonths = [],
  basicDeductionAmount,
  readOnly = false,
  hiddenFieldKeys = [],
  onClose,
  onSelectMonth,
  onChangeRow,
  onApplyToNextMonth,
  onApplyToFutureMonths,
  primaryActionLabel,
  primaryActionDisabled = false,
  onPrimaryAction,
}: Props) => {
  const lockedMonthSet = useMemo(() => new Set(lockedMonths), [lockedMonths]);
  const visibleIncomeFields = useMemo(
    () => getVisibleYearRecordIncomeFields(hiddenFieldKeys),
    [hiddenFieldKeys],
  );

  if (!open) {
    return null;
  }

  return (
    <FloatingWorkspaceDialog
      open={open}
      scope="dialog:year-record-workspace"
      title={title}
      subtitle={subtitle}
      defaultLayout={{
        x: 32,
        y: 32,
        width: 1480,
        height: 920,
        isMaximized: true,
      }}
      onClose={onClose}
    >
      <>
        <div className="workspace-toolbar">
          <span className="tag">当前月份：{selectedMonth} 月</span>
          {!readOnly ? (
            <div className="button-row compact">
              {onApplyToNextMonth ? (
                <button className="ghost-button" type="button" onClick={onApplyToNextMonth}>
                  将本月数据应用到下月
                </button>
              ) : null}
              {onApplyToFutureMonths ? (
                <button className="ghost-button" type="button" onClick={onApplyToFutureMonths}>
                  将本月数据应用到后续月份
                </button>
              ) : null}
              {primaryActionLabel && onPrimaryAction ? (
                <button
                  className="primary-button"
                  disabled={primaryActionDisabled}
                  type="button"
                  onClick={onPrimaryAction}
                >
                  {primaryActionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="workspace-table-wrapper">
          <table className="data-table workspace-table">
            <thead>
              <tr>
                <th>月份</th>
                {visibleIncomeFields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                {YEAR_RECORD_INCOME_TEXT_FIELDS.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                {YEAR_RECORD_DEDUCTION_FIELDS.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                <th>减除费用</th>
                {YEAR_RECORD_TEXT_FIELDS.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = row.taxMonth === selectedMonth;
                const isLocked = lockedMonthSet.has(row.taxMonth);
                const isDisabled = readOnly || isLocked;

                return (
                  <tr
                    key={row.taxMonth}
                    className={isSelected ? "selectable-row is-selected" : "selectable-row"}
                    onClick={() => onSelectMonth(row.taxMonth)}
                  >
                    <td>
                      <strong>{row.taxMonth} 月</strong>
                      {isLocked ? <div className="tag tag-warning">已确认</div> : null}
                    </td>
                    {visibleIncomeFields.map((field) => (
                      <td key={`${row.taxMonth}-${field.key}`}>
                        <input
                          className="table-input"
                          disabled={isDisabled}
                          min="0"
                          step="0.01"
                          type="number"
                          value={row[field.key]}
                          onChange={(event) =>
                            onChangeRow?.(row.taxMonth, field.key, Number(event.target.value) || 0)
                          }
                        />
                      </td>
                    ))}
                    {YEAR_RECORD_INCOME_TEXT_FIELDS.map((field) => (
                      <td key={`${row.taxMonth}-${field.key}`}>
                        <input
                          className="table-input"
                          disabled={isDisabled}
                          type="text"
                          value={row[field.key]}
                          onChange={(event) =>
                            onChangeRow?.(row.taxMonth, field.key, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    {YEAR_RECORD_DEDUCTION_FIELDS.map((field) => (
                      <td key={`${row.taxMonth}-${field.key}`}>
                        <input
                          className="table-input"
                          disabled={isDisabled}
                          min="0"
                          step="0.01"
                          type="number"
                          value={row[field.key]}
                          onChange={(event) =>
                            onChangeRow?.(row.taxMonth, field.key, Number(event.target.value) || 0)
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <input className="table-input" disabled type="number" value={basicDeductionAmount} />
                    </td>
                    {YEAR_RECORD_TEXT_FIELDS.map((field) => (
                      <td key={`${row.taxMonth}-${field.key}`}>
                        <input
                          className="table-input"
                          disabled={isDisabled}
                          type="text"
                          value={row[field.key]}
                          onChange={(event) =>
                            onChangeRow?.(row.taxMonth, field.key, event.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    </FloatingWorkspaceDialog>
  );
};
