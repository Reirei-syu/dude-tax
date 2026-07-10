import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { useTaxStore } from '../../lib/store/useTaxStore';
import type { Employee } from '../../types';

interface EmployeeComboboxProps {
  /** 标签文案，如「编辑员工」「查看员工」 */
  label?: string;
  className?: string;
  placeholder?: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** 姓名模糊匹配：包含关键字 */
function matchName(name: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const n = normalize(name);
  if (n.includes(q)) return true;
  return n.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
}

/**
 * 员工选择器：可下拉点选，也可输入关键字模糊过滤姓名
 */
export function EmployeeCombobox({
  label = '选择员工',
  className = '',
  placeholder = '输入姓名搜索或点选…',
}: EmployeeComboboxProps) {
  const listId = useId();
  const employees = useTaxStore((s) => s.employees);
  const selectedId = useTaxStore((s) => s.selectedEmployeeId);
  const selectEmployee = useTaxStore((s) => s.selectEmployee);

  const all = useMemo(
    () =>
      Object.values(employees).sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [employees],
  );

  const selected = selectedId ? employees[selectedId] : null;
  const selectedName = selected?.name ?? '';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedName);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 正在主动关闭，避免 blur→focus 链路再次打开 */
  const suppressOpenRef = useRef(false);
  const selectedNameRef = useRef(selectedName);
  selectedNameRef.current = selectedName;

  // 外部选中变化且列表已收起时，同步输入框展示名
  useEffect(() => {
    if (!open) {
      setQuery(selectedName);
    }
  }, [selectedId, selectedName, open]);

  const filtered = useMemo(() => {
    if (!query.trim() || query === selectedName) {
      return all;
    }
    return all.filter((e) => matchName(e.name, query));
  }, [all, query, selectedName]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const closeMenu = useCallback((restoreQuery = true) => {
    suppressOpenRef.current = true;
    setOpen(false);
    if (restoreQuery) {
      setQuery(selectedNameRef.current);
    }
    // 下一帧解除抑制，避免 onFocus 立刻 reopen
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
  }, []);

  // 点击组件外：收起
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (t && rootRef.current?.contains(t)) return;
      closeMenu(true);
      inputRef.current?.blur();
    };
    // capture 阶段，避免被画布/节点拦截后无法收起
    document.addEventListener('pointerdown', onDocPointer, true);
    return () =>
      document.removeEventListener('pointerdown', onDocPointer, true);
  }, [open, closeMenu]);

  const pick = useCallback(
    (emp: Employee) => {
      selectEmployee(emp.id);
      selectedNameRef.current = emp.name;
      setQuery(emp.name);
      closeMenu(false);
      // 选完后移出焦点，避免输入框仍聚焦导致再次点选困难
      inputRef.current?.blur();
    },
    [selectEmployee, closeMenu],
  );

  const openMenu = useCallback(() => {
    if (suppressOpenRef.current || all.length === 0) return;
    setOpen(true);
  }, [all.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = filtered[highlight];
      if (hit) pick(hit);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
      inputRef.current?.blur();
    }
  };

  const empty = all.length === 0;

  return (
    <div
      ref={rootRef}
      className={`employee-combobox mb-3 flex flex-wrap items-center gap-2 ${className}`}
    >
      <label
        className="shrink-0 text-xs font-medium text-[var(--text-muted)]"
        htmlFor={listId + '-input'}
      >
        {label}
      </label>
      <div className="employee-combobox-field relative min-w-[12rem] max-w-full flex-1 sm:max-w-[18rem]">
        <input
          ref={inputRef}
          id={listId + '-input'}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          disabled={empty}
          className="field w-full pr-8"
          placeholder={empty ? '暂无员工' : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            openMenu();
          }}
          onFocus={() => {
            if (suppressOpenRef.current) return;
            openMenu();
            if (selected && query === selected.name) {
              requestAnimationFrame(() => inputRef.current?.select());
            }
          }}
          onBlur={(e) => {
            // 焦点仍在本组件内（如点箭头）则不关
            const next = e.relatedTarget as Node | null;
            if (next && rootRef.current?.contains(next)) return;
            // 延迟：让选项 mousedown 先完成选中
            window.setTimeout(() => {
              if (suppressOpenRef.current) return;
              if (rootRef.current?.contains(document.activeElement)) return;
              closeMenu(true);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
          tabIndex={-1}
          aria-label={open ? '收起员工列表' : '打开员工列表'}
          disabled={empty}
          onMouseDown={(e) => {
            // 避免 button 抢焦点触发 input blur 竞态
            e.preventDefault();
          }}
          onClick={() => {
            if (open) {
              closeMenu(true);
              inputRef.current?.blur();
            } else {
              openMenu();
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && !empty && (
          <ul id={listId} role="listbox" className="employee-combobox-menu">
            {filtered.length === 0 ? (
              <li className="employee-combobox-empty">无匹配员工</li>
            ) : (
              filtered.map((emp, i) => (
                <li
                  key={emp.id}
                  role="option"
                  aria-selected={emp.id === selectedId}
                  className={`employee-combobox-option ${
                    i === highlight ? 'is-active' : ''
                  } ${emp.id === selectedId ? 'is-selected' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(emp);
                  }}
                >
                  {emp.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
