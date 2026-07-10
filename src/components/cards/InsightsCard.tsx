import { useMemo } from 'react';
import { GlassCard } from '../common/GlassCard';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { generateMonthlyInsights } from '../../lib/tax/explanations';

export function InsightsCard({ fill = false }: { fill?: boolean }) {
  const selectedId = useTaxStore((s) => s.selectedEmployeeId);
  const employees = useTaxStore((s) => s.employees);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);
  const banner = useTaxStore((s) => s.statusBanner);

  const emp = selectedId ? employees[selectedId] : null;
  const depKey = selectedId
    ? JSON.stringify({
        m: monthlyRecords[selectedId],
        h: emp?.hireDate,
        l: emp?.leaveDate,
        f: emp?.isFirstTime,
      })
    : '';

  const insights = useMemo(() => {
    if (!selectedId) return [];
    const rows = getEmployeeCalc(selectedId);
    return generateMonthlyInsights(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, depKey, getEmployeeCalc]);

  if (!emp) {
    return (
      <GlassCard title="智能解读" fill={fill}>
        <p className="m-0 text-sm text-[var(--text-muted)]">
          选择员工后显示各月税额变化解读。
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      title={`智能解读 · ${emp.name}`}
      subtitle="为什么这个月税变了？"
      fill={fill}
    >
      {banner && <div className="banner banner-accent mb-3">{banner}</div>}
      <div
        className={`${fill ? 'max-h-none' : 'max-h-80'} space-y-2 overflow-auto pr-0.5`}
      >
        {insights.map((text, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]"
          >
            <span className="badge badge-soft mr-1.5 align-middle">
              {i + 1}月
            </span>
            {text}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
