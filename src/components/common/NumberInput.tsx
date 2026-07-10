import { useEffect, useState } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * 数字录入：
 * - 存 0 时界面显示为空（不显示 0），避免在「0」后输入变成「10」
 * - 清空时写回 0
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  className = '',
  ariaLabel,
}: NumberInputProps) {
  const [text, setText] = useState(() => formatDisplay(value));
  const [focused, setFocused] = useState(false);

  // 外部 value 变化且未聚焦时同步显示（如切换月份、复制）
  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value));
    }
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      min={min}
      step={step}
      value={text}
      aria-label={ariaLabel}
      placeholder=""
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const n = parseInput(text, min);
        onChange(n);
        setText(formatDisplay(n));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // 允许空、小数点过程态（如 "1."、"."）
        if (raw === '' || raw === '.' || raw === '-') {
          setText(raw === '-' ? '' : raw);
          onChange(min > 0 ? min : 0);
          return;
        }
        // 仅允许数字与一个小数点
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = parseFloat(raw);
        if (Number.isFinite(n)) {
          onChange(Math.max(min, n));
        }
      }}
      className={`field num-input text-right ${className}`}
    />
  );
}

/** 0 / 非有限数 → 空字符串，否则去掉多余尾零的展示 */
function formatDisplay(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  // 避免 10.5 变成科学计数；保留合理小数
  const s = String(value);
  if (s.includes('e') || s.includes('E')) return value.toFixed(2);
  return s;
}

function parseInput(text: string, min: number): number {
  const t = text.trim();
  if (t === '' || t === '.' || t === '-') return Math.max(min, 0);
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return Math.max(min, 0);
  return Math.max(min, n);
}
