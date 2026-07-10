/**
 * 单实例文件锁（可注入 FS，便于单测）
 * Tauri 路径：在 AppConfig 下创建 dude-tax.lock，独占打开；第二进程失败。
 */

export interface LockFileHandle {
  /** 释放锁（关闭句柄 / 删除标记） */
  release: () => void | Promise<void>;
}

export interface LockFs {
  /**
   * 尝试独占创建/打开锁文件。
   * 成功返回 handle；已被占用则 throw 或返回 null（实现二选一，本模块约定 throw）。
   */
  tryExclusiveOpen: (path: string) => Promise<LockFileHandle> | LockFileHandle;
}

export class InstanceLockBusyError extends Error {
  constructor(message = '另一个 Dude Tax 实例已在运行') {
    super(message);
    this.name = 'InstanceLockBusyError';
  }
}

export const DEFAULT_LOCK_FILE_NAME = 'dude-tax.lock';

/**
 * 尝试获取实例锁。
 * @throws InstanceLockBusyError 若无法独占
 */
export async function acquireInstanceLock(
  lockPath: string,
  fs: LockFs,
): Promise<LockFileHandle> {
  try {
    return await Promise.resolve(fs.tryExclusiveOpen(lockPath));
  } catch (e) {
    if (e instanceof InstanceLockBusyError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // 标准化为 Busy，便于 UI
    throw new InstanceLockBusyError(
      msg.includes('另一个') ? msg : `无法获取实例锁：${msg}`,
    );
  }
}

/**
 * 内存 FS：单测用，同一 path 仅允许一个 handle
 */
export function createMemoryLockFs(): LockFs & {
  held: Set<string>;
} {
  const held = new Set<string>();
  return {
    held,
    tryExclusiveOpen(path: string): LockFileHandle {
      if (held.has(path)) {
        throw new InstanceLockBusyError();
      }
      held.add(path);
      return {
        release: () => {
          held.delete(path);
        },
      };
    },
  };
}
