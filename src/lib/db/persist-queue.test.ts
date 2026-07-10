import { describe, expect, it } from 'vitest';
import { createPersistQueue } from './persist-queue';
import {
  createIsolatedStoreState,
  resetPersistQueueForTests,
  useTaxStore,
} from '../store/useTaxStore';
import { TaxRepository } from './repository';

describe('createPersistQueue', () => {
  it('serializes writes and always builds at execution time (no stale overwrite)', async () => {
    const writes: number[] = [];
    let state = 0;
    const delays: Array<() => void> = [];

    const q = createPersistQueue(
      () => state,
      async (snap) => {
        // first write is slow
        if (writes.length === 0) {
          await new Promise<void>((r) => {
            delays.push(r);
          });
        }
        writes.push(snap);
      },
    );

    const p1 = q.enqueue(); // will write after delay; state may change
    // 让 p1 进入 write 并挂起
    await Promise.resolve();
    await Promise.resolve();
    expect(delays.length).toBe(1);

    // mutate before first write completes
    state = 1;
    const p2 = q.enqueue();
    state = 2;
    const p3 = q.enqueue();

    // release first slow write
    delays[0]!();
    await Promise.all([p1, p2, p3]);

    // all jobs rebuild at run time; last write must be 2
    expect(writes[writes.length - 1]).toBe(2);
    // 不得在写入更新值之后再提交更旧快照
    for (let i = 1; i < writes.length; i++) {
      expect(writes[i]!).toBeGreaterThanOrEqual(writes[i - 1]!);
    }
  });
});

describe('store persistNow overlapping (real saveSnapshot)', () => {
  it('final disk state matches later edits when two persists overlap', async () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    const repo = await TaxRepository.createInMemory();
    useTaxStore.getState().setRepo(repo);
    useTaxStore.getState().bootstrapDefault('重叠单位', 2026);
    await useTaxStore.getState().persistNow();

    const empId = useTaxStore.getState().selectedEmployeeId!;
    useTaxStore.getState().updateMonthSalary(empId, 1, 1_000);

    // 自定义慢写：劫持 saveSnapshot
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let saveCount = 0;
    const orig = repo.saveSnapshot.bind(repo);
    repo.saveSnapshot = async (snap) => {
      saveCount += 1;
      if (saveCount === 1) {
        await gate;
      }
      return orig(snap);
    };

    resetPersistQueueForTests();
    // 重新绑定 queue 到当前 getState
    const pSlow = useTaxStore.getState().persistNow();
    // 在慢写等待期间改成更高工资
    useTaxStore.getState().updateMonthSalary(empId, 1, 9_999);
    const pFast = useTaxStore.getState().persistNow();
    release();
    await Promise.all([pSlow, pFast]);

    const wsId = useTaxStore.getState().workspace!.id;
    const loaded = await repo.loadWorkspace(wsId);
    expect(loaded).not.toBeNull();
    expect(loaded!.monthlyRecords[empId]![0]!.salary).toBe(9_999);
  });
});
