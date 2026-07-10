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
 * 基于 BEGIN/COMMIT 的事务包装。
 * 支持嵌套：内层使用 SAVEPOINT，避免 sql.js / SQLite 嵌套 BEGIN 失败。
 */
export function createBaseTransaction(
  execute: (sql: string, params?: SqlValue[]) => Promise<void>,
): <T>(fn: () => Promise<T>) => Promise<T> {
  let depth = 0;
  let sp = 0;
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (depth === 0) {
      await execute('BEGIN');
      depth = 1;
      try {
        const result = await fn();
        await execute('COMMIT');
        depth = 0;
        return result;
      } catch (e) {
        try {
          await execute('ROLLBACK');
        } catch {
          /* ignore */
        }
        depth = 0;
        throw e;
      }
    }
    // nested
    sp += 1;
    const name = `sp_${sp}`;
    depth += 1;
    await execute(`SAVEPOINT ${name}`);
    try {
      const result = await fn();
      await execute(`RELEASE SAVEPOINT ${name}`);
      depth -= 1;
      return result;
    } catch (e) {
      try {
        await execute(`ROLLBACK TO SAVEPOINT ${name}`);
        await execute(`RELEASE SAVEPOINT ${name}`);
      } catch {
        /* ignore */
      }
      depth -= 1;
      throw e;
    }
  };
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
