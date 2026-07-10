/**
 * 串行化持久化写队列：
 * - 重叠的 persist 严格串行
 * - 每次真正执行写时重新 build() 最新快照（避免旧快照覆盖新状态）
 */

export type SnapshotBuilder<T> = () => T | null;
export type SnapshotWriter<T> = (snap: T) => Promise<void>;

export interface PersistQueue {
  /** 请求一次落盘（串行；执行时取最新 state） */
  enqueue: () => Promise<void>;
  /** 累计 enqueue 次数（测试用） */
  getGeneration: () => number;
  /** 是否有进行中的写（测试用） */
  isBusy: () => boolean;
}

export function createPersistQueue<T>(
  build: SnapshotBuilder<T>,
  write: SnapshotWriter<T>,
): PersistQueue {
  let chain: Promise<void> = Promise.resolve();
  let generation = 0;
  let inFlight = 0;

  const enqueue = (): Promise<void> => {
    generation += 1;
    const job = chain.then(
      async () => {
        inFlight += 1;
        try {
          // 关键：执行时刻再 build，保证用最新 store 状态
          const snap = build();
          if (snap != null) {
            await write(snap);
          }
        } finally {
          inFlight -= 1;
        }
      },
      async () => {
        inFlight += 1;
        try {
          const snap = build();
          if (snap != null) {
            await write(snap);
          }
        } finally {
          inFlight -= 1;
        }
      },
    );
    // 不让单次失败打断后续队列
    chain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };

  return {
    enqueue,
    getGeneration: () => generation,
    isBusy: () => inFlight > 0,
  };
}
