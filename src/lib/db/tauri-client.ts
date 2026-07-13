/**
 * Tauri plugin-sql 后端：EXE 正式持久化路径
 */

import Database from '@tauri-apps/plugin-sql';
import type { SqlClient, SqlValue } from './sql-client';
import { createBaseTransaction, qmarkToDollar } from './sql-client';
import { getTauriDbFileName, getTauriDbUrl } from './db-paths';

export const TAURI_DB_NAME = 'dude-tax.db';
export const TAURI_DB_URL = `sqlite:${TAURI_DB_NAME}`;

export class TauriSqlClient implements SqlClient {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  static async open(dbUrl: string = getTauriDbUrl()): Promise<TauriSqlClient> {
    const db = await Database.load(dbUrl);
    const client = new TauriSqlClient(db);
    // 写冲突时等待而非立刻 SQLITE_BUSY（开发/关窗 flush 并发时常见）
    try {
      await client.execute('PRAGMA busy_timeout = 8000');
      await client.execute('PRAGMA journal_mode = WAL');
      await client.execute('PRAGMA synchronous = NORMAL');
    } catch {
      /* 部分环境 pragma 失败不阻断打开 */
    }
    return client;
  }

  /** 当前环境实际库文件名（开发 / 安装不同） */
  static currentDbFileName(): string {
    return getTauriDbFileName();
  }

  async execute(sql: string, params?: SqlValue[]): Promise<void> {
    const converted = qmarkToDollar(sql);
    await this.db.execute(converted, params ?? []);
  }

  async select<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]> {
    const converted = qmarkToDollar(sql);
    return this.db.select<T[]>(converted, params ?? []) as Promise<T[]>;
  }

  withTransaction = createBaseTransaction((sql, params) =>
    this.execute(sql, params),
  );

  exportBytes(): null {
    return null;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
