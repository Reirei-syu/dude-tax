import { useMemo, useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';

/** 导航栏内直接展示的最多年度数；超出部分收进「…」对话框 */
const MAX_INLINE_YEARS = 5;

export interface YearSelectorProps {
  /** 已有年度，降序 */
  years: number[];
  selectedYear: number | null;
  nextYearToCreate: number | null;
  maxOrgYear: number | null;
  disabled?: boolean;
  tabIndex?: number;
  onSelectYear: (year: number) => void;
  onCreateNextYear: () => void;
}

/**
 * 计算导航栏内联展示的年度：
 * - ≤5 个：全部展示
 * - ＞5 个：优先最新 4 个 +「…」；若当前选中为更早年度，则把选中年纳入内联并仍保留「…」
 */
export function computeInlineYears(
  yearsDesc: number[],
  selectedYear: number | null,
): { inline: number[]; hasMore: boolean; historyYears: number[] } {
  if (yearsDesc.length <= MAX_INLINE_YEARS) {
    return {
      inline: yearsDesc,
      hasMore: false,
      historyYears: [],
    };
  }

  // 超过 5：内联最多 4 个最新，其余进历史
  const newest = yearsDesc.slice(0, MAX_INLINE_YEARS - 1);
  let inline = [...newest];

  if (
    selectedYear != null &&
    yearsDesc.includes(selectedYear) &&
    !inline.includes(selectedYear)
  ) {
    // 当前在历史区：用选中年替换内联中最旧的一个，保证选中可见
    inline = [selectedYear, ...newest.slice(0, MAX_INLINE_YEARS - 2)].sort(
      (a, b) => b - a,
    );
  }

  const inlineSet = new Set(inline);
  const historyYears = yearsDesc.filter((y) => !inlineSet.has(y));

  return {
    inline,
    hasMore: historyYears.length > 0,
    historyYears,
  };
}

export function YearSelector({
  years,
  selectedYear,
  nextYearToCreate,
  maxOrgYear,
  disabled = false,
  tabIndex = 0,
  onSelectYear,
  onCreateNextYear,
}: YearSelectorProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const { inline, hasMore, historyYears } = useMemo(
    () => computeInlineYears(years, selectedYear),
    [years, selectedYear],
  );

  const openHistory = () => {
    if (disabled || !hasMore) return;
    setHistoryOpen(true);
  };

  const pickHistory = (year: number) => {
    setHistoryOpen(false);
    onSelectYear(year);
  };

  return (
    <>
      <div
        className={`year-selector year-selector-bar ${disabled ? 'is-disabled' : ''}`}
        title="切换已有年度，或新建下一年度（继承期末数据）"
        role="group"
        aria-label="纳税年度"
      >
        <CalendarDays size={14} className="year-selector-icon" aria-hidden />
        <span className="year-selector-label">年度</span>

        <div className="year-chip-row">
          {inline.map((y) => {
            const active = selectedYear === y;
            return (
              <button
                key={y}
                type="button"
                className={`year-chip ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                aria-label={`${y} 年`}
                tabIndex={tabIndex}
                disabled={disabled}
                onClick={() => onSelectYear(y)}
              >
                {y}
              </button>
            );
          })}

          {hasMore && (
            <button
              type="button"
              className={`year-chip year-chip-more ${
                selectedYear != null && historyYears.includes(selectedYear)
                  ? 'is-active'
                  : ''
              }`}
              title="选择历史年份"
              aria-label="选择历史年份"
              tabIndex={tabIndex}
              disabled={disabled}
              onClick={openHistory}
            >
              …
            </button>
          )}
        </div>

        {nextYearToCreate != null && (
          <button
            type="button"
            className="year-chip year-chip-create"
            title={
              maxOrgYear != null
                ? `新建 ${nextYearToCreate} 年（继承 ${maxOrgYear} 期末）`
                : `新建 ${nextYearToCreate} 年`
            }
            aria-label={`新建 ${nextYearToCreate} 年`}
            tabIndex={tabIndex}
            disabled={disabled}
            onClick={onCreateNextYear}
          >
            <Plus size={12} strokeWidth={2.5} aria-hidden />
            {nextYearToCreate}
          </button>
        )}
      </div>

      {historyOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 120 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="year-history-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false);
          }}
        >
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <CalendarDays size={16} />
                </span>
                <div className="min-w-0">
                  <h2 id="year-history-title" className="panel-title">
                    选择历史年份
                  </h2>
                  <p className="panel-subtitle">
                    共 {years.length} 个年度 · 点击切换
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setHistoryOpen(false)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p className="mt-0 mb-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
                导航栏仅显示最近年份；更早的年度请在此选择。
              </p>
              <div className="year-history-grid">
                {years.map((y) => {
                  const active = selectedYear === y;
                  const isHistory = historyYears.includes(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      className={`year-history-item ${active ? 'is-active' : ''} ${
                        isHistory ? 'is-history' : ''
                      }`}
                      aria-pressed={active}
                      onClick={() => pickHistory(y)}
                    >
                      <span className="num font-semibold">{y}</span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        年
                        {active ? ' · 当前' : isHistory ? ' · 历史' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHistoryOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
