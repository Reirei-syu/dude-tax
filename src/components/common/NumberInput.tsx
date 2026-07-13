import { useEffect, useState } from 'react';

interface NumberInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
  /**
   * true：清空 → null，0 显示为 "0"（用于工资单扣缴等「未填」与 0 需区分的场景）
   * false（默认）：清空 → 0，0 显示为空（现有工资字段习惯）
   */
  nullable?: boolean;
}

/**
 * 数字录入：
 * - 默认：存 0 时界面显示为空，清空写回 0
 * - nullable：null 显示为空；0 显示 0；清空写回 null
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  className = '',
  ariaLabel,
  nullable = false,
}: NumberInputProps) {
  const [text, setText] = useState(() => formatDisplay(value, nullable));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value, nullable));
    }
  }, [value, focused, nullable]);

  const commit = (raw: string) => {
    if (raw === '' || raw === '.') {
      if (nullable) {
        onChange(null);
        setText('');
      } else {
        const n = min > 0 ? min : 0;
        onChange(n);
        setText(formatDisplay(n, nullable));
      }
      return;
    }
    const n = parseInput(raw, min);
    onChange(n);
    setText(formatDisplay(n, nullable));
  };

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
        commit(text);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || raw === '.' || raw === '-') {
          setText(raw === '-' ? '' : raw);
          if (nullable) {
            onChange(null);
          } else {
            onChange(min > 0 ? min : 0);
          }
          return;
        }
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

function formatDisplay(value: number | null, nullable: boolean): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (!nullable && value === 0) return '';
  if (nullable && value === 0) return '0';
  const s = String(value);
  if (s.includes('e') || s.includes('E')) return value.toFixed(2);
  return s;
}

function parseInput(text: string, min: number): number {
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return min > 0 ? min : 0;
  return Math.max(min, n);
}
