/**
 * sql.js 后端：单元测试 + 浏览器 dev 回退
 */

import type { Database, SqlJsStatic } from 'sql.js';
import type { SqlClient, SqlValue } from './sql-client';
import { createBaseTransaction } from './sql-client';
import { SCHEMA_SQL } from './schema';

let SQL: SqlJsStatic | null = null;

async function getSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    const mod = await import('sql.js/dist/sql-asm.js');
    const initSqlJs = (mod.default ?? mod) as (
      cfg?: object,
    ) => Promise<SqlJsStatic>;
    SQL = await initSqlJs();
  }
  return SQL;
}

function toBind(params?: SqlValue[]): (string | number | null | Uint8Array)[] {
  if (!params?.length) return [];
  return params.map((p) => {
    if (p === null || p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as string | number | Uint8Array;
  });
}

export class SqlJsClient implements SqlClient {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  static async createInMemory(): Promise<SqlJsClient> {
    const sql = await getSql();
    const db = new sql.Database();
    db.run(SCHEMA_SQL);
    return new SqlJsClient(db);
  }

  static async createFromBytes(bytes: Uint8Array): Promise<SqlJsClient> {
    const sql = await getSql();
    const db = new sql.Database(bytes);
    db.run(SCHEMA_SQL);
    return new SqlJsClient(db);
  }

  async execute(sql: string, params?: SqlValue[]): Promise<void> {
    this.db.run(sql, toBind(params));
  }

  async select<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      if (params?.length) {
        stmt.bind(toBind(params));
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  withTransaction = createBaseTransaction((sql, params) =>
    this.execute(sql, params),
  );

  exportBytes(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}
