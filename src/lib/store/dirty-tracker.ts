/**
 * 工作区内脏数据追踪：支撑增量落盘（仅写变更员工）
 * clearAfterWrite 仅在「捕获时的 revision 仍未变」时清脏，避免慢写中途再编辑被误清。
 */

export interface DirtyWriteCapture {
  dirtyIds: string[];
  removedIds: string[];
  layout: boolean;
  /** 构建 job 时各脏员工的 revision */
  revisionsAtCapture: Record<string, number>;
  /** 构建 job 时各待删除员工的 generation */
  removedGensAtCapture: Record<string, number>;
  /** 构建 job 时的 layout generation */
  layoutGenAtCapture: number;
}

export interface DirtyTracker {
  markEmployee(id: string): void;
  markRemoved(id: string): void;
  markLayout(): void;
  getDirtyEmployeeIds(): string[];
  getRemovedEmployeeIds(): string[];
  isLayoutDirty(): boolean;
  getEmployeeRevision(id: string): number;
  getRemovedGeneration(id: string): number;
  getLayoutGeneration(): number;
  /** 成功写入后：仅当 id 的 revision/gen 与捕获一致时清脏 */
  clearAfterWrite(job: DirtyWriteCapture): void;
  reset(): void;
  getDataEpoch(): number;
}

export function createDirtyTracker(): DirtyTracker {
  const dirty = new Set<string>();
  const removed = new Set<string>();
  let layoutDirty = false;
  let dataEpoch = 0;
  let layoutGen = 0;
  const empRev = new Map<string, number>();
  const removedGen = new Map<string, number>();

  return {
    markEmployee(id: string) {
      if (!id) return;
      dirty.add(id);
      removed.delete(id);
      removedGen.delete(id);
      empRev.set(id, (empRev.get(id) ?? 0) + 1);
      dataEpoch += 1;
    },
    markRemoved(id: string) {
      if (!id) return;
      removed.add(id);
      dirty.delete(id);
      empRev.delete(id);
      removedGen.set(id, (removedGen.get(id) ?? 0) + 1);
      dataEpoch += 1;
    },
    markLayout() {
      layoutDirty = true;
      layoutGen += 1;
    },
    getDirtyEmployeeIds: () => [...dirty],
    getRemovedEmployeeIds: () => [...removed],
    isLayoutDirty: () => layoutDirty,
    getEmployeeRevision(id: string) {
      return empRev.get(id) ?? 0;
    },
    getRemovedGeneration(id: string) {
      return removedGen.get(id) ?? 0;
    },
    getLayoutGeneration: () => layoutGen,
    clearAfterWrite(job) {
      for (const id of job.dirtyIds) {
        const captured = job.revisionsAtCapture[id];
        if (
          captured !== undefined &&
          empRev.get(id) === captured &&
          dirty.has(id)
        ) {
          dirty.delete(id);
        }
      }
      for (const id of job.removedIds) {
        const captured = job.removedGensAtCapture[id];
        if (
          captured !== undefined &&
          removedGen.get(id) === captured &&
          removed.has(id)
        ) {
          removed.delete(id);
          removedGen.delete(id);
        }
      }
      if (
        job.layout &&
        layoutDirty &&
        job.layoutGenAtCapture === layoutGen
      ) {
        layoutDirty = false;
      }
    },
    reset() {
      dirty.clear();
      removed.clear();
      layoutDirty = false;
      empRev.clear();
      removedGen.clear();
      layoutGen = 0;
      dataEpoch += 1;
    },
    getDataEpoch: () => dataEpoch,
  };
}
