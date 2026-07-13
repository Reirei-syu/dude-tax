/**
 * 统一 SQL 后端：sql.js（测试 / Web 回退）与 Tauri plugin-sql（EXE）
 * 仓库层统一使用 `?` 占位符；Tauri 侧转换为 `$1..$n`
 */

export type SqlValue = string | number | null | boolean | Uint8Array;

export interface SqlClient {
  execute(sql: string, params?: SqlValue[]): Promise<void>;
  select<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]>;
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  /** sql.js 可导出；Tauri 文件库返回 null */
  exportBytes(): Uint8Array | null;
  close?(): Promise<void> | void;
}

/** 将 `?` 顺序替换为 sqlx/SQLite 的 `$1, $2, ...`（忽略字符串字面量内的 ?） */
export function qmarkToDollar(sql: string): string {
  let out = '';
  let i = 0;
  let n = 0;
  let inSingle = false;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (inSingle) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        inSingle = false;
      }
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '?') {
      n += 1;
      out += `$${n}`;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * 是否为 SQLite 忙锁类错误（可重试）。
 * 匹配收紧：避免 code: 50 / 500 等误判。
 */
export function isSqliteBusyError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  const m = msg.toLowerCase();
  if (
    m.includes('database is locked') ||
    m.includes('database is busy') ||
    m.includes('sqlite_busy') ||
    m.includes('sqlite_locked') ||
    m.includes('cannot start a transaction within a transaction')
  ) {
    return true;
  }
  if (/\bcode:\s*5\b/.test(m) || /\bcode:\s*6\b/.test(m)) return true;
  if (/\berror\s*code\s*5\b/.test(m) || /\berror\s*code\s*6\b/.test(m)) {
    return true;
  }
  return false;
}

/** 对单次写操作在忙锁时指数退避重试 */
export async function withSqliteBusyRetry<T>(
  op: () => Promise<T>,
  opts?: { retries?: number; baseMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 6;
  const baseMs = opts?.baseMs ?? 40;
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await op();
    } catch (e) {
      last = e;
      if (!isSqliteBusyError(e) || i === retries) throw e;
      const wait = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 20);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

/**
 * 基于 BEGIN/COMMIT 的事务包装。
 *
 * 所有 withTransaction 调用一律经 topLevelChain **串行**，不做 SAVEPOINT 嵌套。
 * 仓库层禁止在 withTransaction 内再调 withTransaction（改为 body 方法）。
 * 顶层事务在忙锁时整段重试。
 */
export function createBaseTransaction(
  execute: (sql: string, params?: SqlValue[]) => Promise<void>,
): <T>(fn: () => Promise<T>) => Promise<T> {
  let topLevelChain: Promise<unknown> = Promise.resolve();

  const runTopLevelOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
    await execute('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      await execute('COMMIT');
      return result;
    } catch (e) {
      try {
        await execute('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    }
  };

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const run = async (): Promise<T> =>
      withSqliteBusyRetry(() => runTopLevelOnce(fn), {
        retries: 6,
        baseMs: 50,
      });

    const job = topLevelChain.then(run, run);
    topLevelChain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };
}

/**
 * 用户可读的完整保存失败文案（已含「保存失败」语义，UI 勿再叠前缀）。
 */
export function formatPersistError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (!raw || raw === 'undefined') {
    return '保存失败，请稍后重试';
  }
  if (isSqliteBusyError(e)) {
    return '保存繁忙（数据库正被占用），已自动重试仍失败，请稍后再试或点击「立即保存」';
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes('access') ||
    lower.includes('permission') ||
    lower.includes('denied') ||
    lower.includes('readonly') ||
    lower.includes('read-only') ||
    lower.includes('os error 5')
  ) {
    return `保存失败：无写权限或文件只读（${raw}）`;
  }
  if (
    lower.includes('disk') ||
    lower.includes('space') ||
    lower.includes('no space')
  ) {
    return `保存失败：磁盘空间不足（${raw}）`;
  }
  return `保存失败：${raw}`;
}

/** 在业务 execute 达到 failAfter 次后抛错（事务语句不计数） */
export class FailAfterSqlClient implements SqlClient {
  private count = 0;
  private inner: SqlClient;
  private failAfter: number;
  private message: string;
  withTransaction: SqlClient['withTransaction'];

  constructor(
    inner: SqlClient,
    failAfter: number,
    message = 'injected write failure',
  ) {
    this.inner = inner;
    this.failAfter = failAfter;
    this.message = message;
    this.withTransaction = createBaseTransaction((sql, params) =>
      this.execute(sql, params),
    );
  }

  async execute(sql: string, params?: SqlValue[]): Promise<void> {
    const isCtl =
      /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql);
    if (!isCtl) {
      this.count += 1;
      if (this.count > this.failAfter) {
        throw new Error(this.message);
      }
    }
    return this.inner.execute(sql, params);
  }

  select<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]> {
    return this.inner.select<T>(sql, params);
  }

  exportBytes(): Uint8Array | null {
    return this.inner.exportBytes();
  }

  close(): void | Promise<void> {
    return this.inner.close?.();
  }

  getExecuteCount(): number {
    return this.count;
  }
}
