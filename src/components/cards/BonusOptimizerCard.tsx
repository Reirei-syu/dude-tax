import { useMemo } from 'react';
import { GlassCard } from '../common/GlassCard';
import { NumberInput } from '../common/NumberInput';
import { useTaxStore } from '../../lib/store/useTaxStore';
import { formatYuan } from '../../lib/tax/fen';
import { generateBonusExplanation } from '../../lib/tax/explanations';

export function BonusOptimizerCard({ fill = false }: { fill?: boolean }) {
  const selectedId = useTaxStore((s) => s.selectedEmployeeId);
  const employees = useTaxStore((s) => s.employees);
  const bonusRecords = useTaxStore((s) => s.bonusRecords);
  const monthlyRecords = useTaxStore((s) => s.monthlyRecords);
  const setBonus = useTaxStore((s) => s.setBonus);
  const getBonusCompare = useTaxStore((s) => s.getBonusCompare);
  const getEmployeeCalc = useTaxStore((s) => s.getEmployeeCalc);

  const emp = selectedId ? employees[selectedId] : null;
  const bonus = selectedId ? (bonusRecords[selectedId] ?? 0) : 0;
  const depKey = selectedId
    ? JSON.stringify({
        b: bonusRecords[selectedId],
        m: monthlyRecords[selectedId],
        h: emp?.hireDate,
        l: emp?.leaveDate,
        f: emp?.isFirstTime,
      })
    : '';

  const cmp = useMemo(() => {
    if (!selectedId) return null;
    getEmployeeCalc(selectedId);
    return getBonusCompare(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, depKey, getBonusCompare, getEmployeeCalc]);

  if (!emp) {
    return (
      <GlassCard title="年终奖优化器" fill={fill}>
        <p className="m-0 text-sm text-[var(--text-muted)]">
          选择员工后对比「单独计税」与「并入综合所得」。
        </p>
      </GlassCard>
    );
  }

  const separateTotal = cmp
    ? cmp.annualTaxWithoutBonus + cmp.separateTax
    : 0;
  const mergeTotal = cmp?.annualTaxWithBonus ?? 0;
  const lines = cmp ? generateBonusExplanation(cmp) : [];

  return (
    <GlassCard
      title={`年终奖优化 · ${emp.name}`}
      subtitle="单独计税 vs 并入综合所得"
      fill={fill}
    >
      <label className="mb-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        奖金金额（元）
        <div className="w-36">
          <NumberInput
            value={bonus}
            step={100}
            ariaLabel="年终奖金额"
            onChange={(v) => setBonus(emp.id, v)}
          />
        </div>
      </label>

      {cmp && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <div
              className={`compare-card ${
                cmp.recommended === 'separate' ? 'is-recommended' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-[var(--text)]">
                  单独计税
                </span>
                {cmp.recommended === 'separate' && (
                  <span className="badge badge-primary">推荐</span>
                )}
              </div>
              <p className="num mt-2 mb-0 text-xl font-semibold tracking-tight text-[var(--text)]">
                {formatYuan(cmp.separateTax)}
              </p>
              <p className="mt-1.5 mb-0 text-[11px] text-[var(--text-muted)]">
                奖金税额 · 税率 {(cmp.separateRate * 100).toFixed(0)}%
              </p>
              <p className="mt-0.5 mb-0 text-[11px] text-[var(--text-muted)]">
                工资+奖金总税 {formatYuan(separateTotal)}
              </p>
            </div>
            <div
              className={`compare-card ${
                cmp.recommended === 'merge' ? 'is-recommended' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-[var(--text)]">
                  并入综合所得
                </span>
                {cmp.recommended === 'merge' && (
                  <span className="badge badge-primary">推荐</span>
                )}
              </div>
              <p className="num mt-2 mb-0 text-xl font-semibold tracking-tight text-[var(--text)]">
                {formatYuan(cmp.mergeIncrementalTax)}
              </p>
              <p className="mt-1.5 mb-0 text-[11px] text-[var(--text-muted)]">
                奖金边际税额
              </p>
              <p className="mt-0.5 mb-0 text-[11px] text-[var(--text-muted)]">
                全年总税 {formatYuan(mergeTotal)}
              </p>
            </div>
          </div>
          <div className="banner banner-info mb-3">
            税额差（单独 − 并入）
            <span className="num mx-1 font-semibold">
              {formatYuan(cmp.taxDelta)}
            </span>
            元 · 推荐方案约省{' '}
            <span className="num font-semibold">{formatYuan(cmp.savings)}</span>{' '}
            元
          </div>
          <ul className="m-0 list-none space-y-2 p-0 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
