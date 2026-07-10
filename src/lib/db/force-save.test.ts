import { describe, expect, it } from 'vitest';
import {
  createIsolatedStoreState,
  resetPersistQueueForTests,
  useTaxStore,
} from '../store/useTaxStore';
import { TaxRepository } from './repository';

describe('force-save flushPersist (real repo)', () => {
  it('after in-memory edit, flushPersist then reload shows edited salary', async () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    const repo = await TaxRepository.createInMemory();
    useTaxStore.getState().setRepo(repo);
    useTaxStore.getState().bootstrapDefault('强存单位', 2026);
    await useTaxStore.getState().persistNow();

    const empId = useTaxStore.getState().selectedEmployeeId!;
    useTaxStore.getState().updateMonthSalary(empId, 1, 77_777);
    // 立即强制落盘（等同导航栏「立即保存」）
    await useTaxStore.getState().flushPersist();

    const wsId = useTaxStore.getState().workspace!.id;
    const loaded = await repo.loadWorkspace(wsId);
    expect(loaded).not.toBeNull();
    expect(loaded!.monthlyRecords[empId]![0]!.salary).toBe(77_777);
  });
});
