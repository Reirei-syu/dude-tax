import { describe, expect, it } from 'vitest';
import { computeInlineYears } from '../../components/common/YearSelector';

describe('computeInlineYears', () => {
  it('shows all when ≤5', () => {
    const years = [2026, 2025, 2024];
    const r = computeInlineYears(years, 2025);
    expect(r.inline).toEqual([2026, 2025, 2024]);
    expect(r.hasMore).toBe(false);
    expect(r.historyYears).toEqual([]);
  });

  it('caps inline and marks more when >5', () => {
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    const r = computeInlineYears(years, 2026);
    expect(r.inline).toEqual([2026, 2025, 2024, 2023]);
    expect(r.hasMore).toBe(true);
    expect(r.historyYears).toEqual([2022, 2021, 2020]);
    expect(r.inline).not.toContain(2020);
  });

  it('keeps selected historical year visible in inline', () => {
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    const r = computeInlineYears(years, 2020);
    expect(r.inline).toContain(2020);
    expect(r.inline.length).toBeLessThanOrEqual(4);
    expect(r.hasMore).toBe(true);
    expect(r.historyYears.length).toBeGreaterThan(0);
    expect(r.historyYears).not.toContain(2020);
  });
});
