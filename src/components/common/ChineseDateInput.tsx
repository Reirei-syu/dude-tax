import { useMemo } from 'react';
import {
  daysInMonthSafe,
  type Ymd,
  parseToYmd,
  toIsoDate,
} from '../../lib/utils/date';

interface ChineseDateInputProps {
  value: string | null;
  onChange: (isoDate: string) => void;
  /** 年份下拉范围中心，默认当前年 */
  yearHint?: number;
  className?: string;
  /** 允许清空（离职可选） */
  allowEmpty?: boolean;
  ariaLabel?: string;
}

/**
 * 中文习惯年月日选择：××××年 ×月 ×日
 * 对外 value 仍为 YYYY-MM-DD，便于存储与引擎解析
 */
export function ChineseDateInput({
  value,
  onChange,
  yearHint,
  className = '',
  allowEmpty = false,
  ariaLabel,
}: ChineseDateInputProps) {
  const ymd = useMemo(() => parseToYmd(value), [value]);
  const center = yearHint ?? new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = center - 5; y <= center + 5; y++) list.push(y);
    if (ymd && !list.includes(ymd.year)) {
      list.push(ymd.year);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [center, ymd]);

  const year = ymd?.year ?? center;
  const month = ymd?.month ?? 1;
  const day = ymd?.day ?? 1;
  const maxDay = daysInMonthSafe(year, month);

  const emit = (next: Partial<Ymd> | null) => {
    if (next === null) {
      onChange('');
      return;
    }
    const base: Ymd = ymd ?? { year: center, month: 1, day: 1 };
    const merged = {
      year: next.year ?? base.year,
      month: next.month ?? base.month,
      day: next.day ?? base.day,
    };
    const md = daysInMonthSafe(merged.year, merged.month);
    if (merged.day > md) merged.day = md;
    onChange(toIsoDate(merged));
  };

  return (
    <div
      className={`chinese-date-input inline-flex flex-wrap items-center gap-0.5 ${className}`}
      aria-label={ariaLabel}
    >
      <select
        className="field chinese-date-select"
        value={ymd ? String(year) : ''}
        aria-label="年"
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            if (allowEmpty) emit(null);
            return;
          }
          emit({ year: parseInt(v, 10) });
        }}
      >
        {allowEmpty && !ymd && <option value="">年</option>}
        {years.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        className="field chinese-date-select"
        value={ymd ? String(month) : ''}
        aria-label="月"
        disabled={allowEmpty && !ymd}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!ymd) {
            emit({ year: center, month: v, day: 1 });
            return;
          }
          emit({ month: v });
        }}
      >
        {allowEmpty && !ymd && <option value="">月</option>}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        className="field chinese-date-select"
        value={ymd ? String(Math.min(day, maxDay)) : ''}
        aria-label="日"
        disabled={allowEmpty && !ymd}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!ymd) {
            emit({ year: center, month: 1, day: v });
            return;
          }
          emit({ day: v });
        }}
      >
        {allowEmpty && !ymd && <option value="">日</option>}
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
      {allowEmpty && ymd && (
        <button
          type="button"
          className="btn btn-ghost btn-sm px-1 text-[10px]"
          title="清空日期"
          onClick={() => emit(null)}
        >
          清空
        </button>
      )}
    </div>
  );
}
