/**
 * 工作区内脏数据追踪：支撑增量落盘（仅写变更员工）
 */

export interface DirtyTracker {
  markEmployee(id: string): void;
  markRemoved(id: string): void;
  markLayout(): void;
  /** 当前脏员工 id 列表（拷贝） */
  getDirtyEmployeeIds(): string[];
  getRemovedEmployeeIds(): string[];
  isLayoutDirty(): boolean;
  /** 成功写入 job 后清理对应标记 */
  clearAfterWrite(job: {
    dirtyIds: string[];
    removedIds: string[];
    layout: boolean;
  }): void;
  /** 切换工作区 / hydrate 时清空 */
  reset(): void;
  /** 数据世代：任意员工脏标记 +1，供 UI 廉价订阅 */
  getDataEpoch(): number;
  /** 单员工 revision（计税缓存失效） */
  getEmployeeRevision(id: string): number;
}

export function createDirtyTracker(): DirtyTracker {
  const dirty = new Set<string>();
  const removed = new Set<string>();
  let layoutDirty = false;
  let dataEpoch = 0;
  const empRev = new Map<string, number>();

  return {
    markEmployee(id: string) {
      if (!id) return;
      dirty.add(id);
      removed.delete(id);
      empRev.set(id, (empRev.get(id) ?? 0) + 1);
      dataEpoch += 1;
    },
    markRemoved(id: string) {
      if (!id) return;
      removed.add(id);
      dirty.delete(id);
      empRev.delete(id);
      dataEpoch += 1;
    },
    markLayout() {
      layoutDirty = true;
    },
    getDirtyEmployeeIds: () => [...dirty],
    getRemovedEmployeeIds: () => [...removed],
    isLayoutDirty: () => layoutDirty,
    clearAfterWrite(job) {
      for (const id of job.dirtyIds) dirty.delete(id);
      for (const id of job.removedIds) removed.delete(id);
      if (job.layout) layoutDirty = false;
    },
    reset() {
      dirty.clear();
      removed.clear();
      layoutDirty = false;
      empRev.clear();
      dataEpoch += 1;
    },
    getDataEpoch: () => dataEpoch,
    getEmployeeRevision(id: string) {
      return empRev.get(id) ?? 0;
    },
  };
}
