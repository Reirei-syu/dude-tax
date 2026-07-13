/**
 * Web 回退：saveIncremental 后必须 re-export 到 localStorage，否则刷新丢数
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LS_DB_KEY,
  loadWebDbBytesFromLocalStorage,
  persistWebDb,
  wireWebLocalStoragePersist,
} from './bootstrap';
import { emptyMonth } from '../../types';
import { TaxRepository } from './repository';
import {
  createIsolatedStoreState,
  resetPersistQueueForTests,
  useTaxStore,
} from '../store/useTaxStore';

const store = new Map<string, string>();

function installLocalStorageMock() {
  store.clear();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

describe('wireWebLocalStoragePersist + saveIncremental', () => {
  beforeEach(() => {
    installLocalStorageMock();
    resetPersistQueueForTests();
    createIsolatedStoreState();
  });

  afterEach(() => {
    store.clear();
  });

  it('after store edit + flushPersist, reload-from-LS recovers the salary', async () => {
    const raw = await TaxRepository.createInMemory();
    const repo = wireWebLocalStoragePersist(raw);
    useTaxStore.getState().setRepo(repo);
    useTaxStore.getState().bootstrapDefault('Web回退单位', 2026);
    await useTaxStore.getState().persistNow();

    expect(store.has(LS_DB_KEY)).toBe(true);

    const empId = useTaxStore.getState().selectedEmployeeId!;
    useTaxStore.getState().updateMonthSalary(empId, 1, 55_555);
    // 日常路径：flush → saveIncremental → 必须写回 localStorage
    await useTaxStore.getState().flushPersist();

    const bytes = loadWebDbBytesFromLocalStorage();
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBeGreaterThan(100);

    // 模拟刷新：从 LS 重建仓库并加载
    const reloaded = await TaxRepository.createFromBytes(bytes!);
    const wsId = useTaxStore.getState().workspace!.id;
    const snap = await reloaded.loadWorkspace(wsId);
    expect(snap).not.toBeNull();
    expect(snap!.monthlyRecords[empId]![0]!.salary).toBe(55_555);
  });

  it('saveSnapshot path still re-exports (backup restore still works on web)', async () => {
    const raw = await TaxRepository.createInMemory();
    const repo = wireWebLocalStoragePersist(raw);
    const { organization, workspace } = await repo.ensureOrgAndWorkspace(
      '全量写',
      2026,
    );
    await repo.saveSnapshot({
      organization,
      workspace,
      employees: [
        {
          id: 'e1',
          workspaceId: workspace.id,
          name: '全量',
          hireDate: '2026-01-01',
          leaveDate: null,
          isFirstTime: false,
        },
      ],
      monthlyRecords: {
        e1: Array.from({ length: 12 }, () => ({
          ...emptyMonth(),
          salary: 100,
        })),
      },
      bonusRecords: { e1: 0 },
      boardLayout: { nodes: [] },
    });

    const bytes = loadWebDbBytesFromLocalStorage();
    expect(bytes).not.toBeNull();
    const again = await TaxRepository.createFromBytes(bytes!);
    const snap = await again.loadWorkspace(workspace.id);
    expect(snap!.monthlyRecords['e1']![0]!.salary).toBe(100);
  });

  it('persistWebDb no-ops safely when exportBytes is null', () => {
    const repo = {
      exportBytes: () => null,
    } as unknown as TaxRepository;
    expect(() => persistWebDb(repo)).not.toThrow();
  });
});
