import { describe, expect, it } from 'vitest';
import { createDirtyTracker } from './dirty-tracker';

describe('dirty-tracker clearAfterWrite revision guard', () => {
  it('keeps employee dirty if re-marked after job capture', () => {
    const t = createDirtyTracker();
    t.markEmployee('a');
    const rev1 = t.getEmployeeRevision('a');
    expect(rev1).toBe(1);

    // simulate mid-flight re-edit
    t.markEmployee('a');
    expect(t.getEmployeeRevision('a')).toBe(2);

    t.clearAfterWrite({
      dirtyIds: ['a'],
      removedIds: [],
      layout: false,
      revisionsAtCapture: { a: rev1 },
      removedGensAtCapture: {},
      layoutGenAtCapture: 0,
    });
    expect(t.getDirtyEmployeeIds()).toEqual(['a']);
  });

  it('clears employee dirty when revision unchanged', () => {
    const t = createDirtyTracker();
    t.markEmployee('a');
    const rev = t.getEmployeeRevision('a');
    t.clearAfterWrite({
      dirtyIds: ['a'],
      removedIds: [],
      layout: false,
      revisionsAtCapture: { a: rev },
      removedGensAtCapture: {},
      layoutGenAtCapture: 0,
    });
    expect(t.getDirtyEmployeeIds()).toEqual([]);
  });

  it('keeps layout dirty if markLayout after capture', () => {
    const t = createDirtyTracker();
    t.markLayout();
    const gen = t.getLayoutGeneration();
    t.markLayout();
    t.clearAfterWrite({
      dirtyIds: [],
      removedIds: [],
      layout: true,
      revisionsAtCapture: {},
      removedGensAtCapture: {},
      layoutGenAtCapture: gen,
    });
    expect(t.isLayoutDirty()).toBe(true);
  });
});
