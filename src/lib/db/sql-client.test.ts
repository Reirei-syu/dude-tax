import { describe, expect, it } from 'vitest';
import {
  createBaseTransaction,
  formatPersistError,
  isSqliteBusyError,
  qmarkToDollar,
  withSqliteBusyRetry,
} from './sql-client';
import { SqlJsClient } from './sqljs-client';

describe('qmarkToDollar', () => {
  it('converts sequential placeholders', () => {
    expect(qmarkToDollar('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
      'SELECT * FROM t WHERE a = $1 AND b = $2',
    );
  });

  it('ignores question marks inside string literals', () => {
    expect(qmarkToDollar("SELECT '?' AS q, x FROM t WHERE id = ?")).toBe(
      "SELECT '?' AS q, x FROM t WHERE id = $1",
    );
  });

  it('handles escaped single quotes', () => {
    expect(qmarkToDollar("SELECT 'it''s' AS s WHERE id = ?")).toBe(
      "SELECT 'it''s' AS s WHERE id = $1",
    );
  });
});

describe('SqlJsClient transaction', () => {
  it('rolls back on error', async () => {
    const client = await SqlJsClient.createInMemory();
    await client.execute(
      `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`,
      ['org1', 'A', '2026-01-01'],
    );

    await expect(
      client.withTransaction(async () => {
        await client.execute(
          `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`,
          ['org2', 'B', '2026-01-01'],
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await client.select<{ id: string }>(
      'SELECT id FROM organizations ORDER BY id',
    );
    expect(rows.map((r) => r.id)).toEqual(['org1']);
  });

  it('serializes concurrent top-level transactions without double BEGIN', async () => {
    const client = await SqlJsClient.createInMemory();
    const orig = client.execute.bind(client);
    const begins: string[] = [];
    client.execute = async (sql, params) => {
      if (/^\s*BEGIN/i.test(sql)) {
        begins.push('BEGIN');
        await new Promise((r) => setTimeout(r, 8));
      }
      if (/^\s*SAVEPOINT/i.test(sql)) {
        begins.push('SAVEPOINT');
      }
      return orig(sql, params);
    };
    client.withTransaction = createBaseTransaction((sql, params) =>
      client.execute(sql, params),
    );

    // 交错：A 已 BEGIN 并 await，B 再开事务 —— 必须串行，不得 SAVEPOINT
    let aInBody = false;
    let bSawAInBody = false;
    const pA = client.withTransaction(async () => {
      aInBody = true;
      await new Promise((r) => setTimeout(r, 30));
      await client.execute(
        `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`,
        ['org_a', 'A', '2026-01-01'],
      );
      aInBody = false;
    });
    await new Promise((r) => setTimeout(r, 5));
    const pB = client.withTransaction(async () => {
      if (aInBody) bSawAInBody = true;
      await client.execute(
        `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`,
        ['org_b', 'B', '2026-01-01'],
      );
    });
    await Promise.all([pA, pB]);

    expect(bSawAInBody).toBe(false);
    expect(begins.filter((x) => x === 'SAVEPOINT')).toHaveLength(0);
    expect(begins.filter((x) => x === 'BEGIN').length).toBeGreaterThanOrEqual(2);

    const rows = await client.select<{ id: string }>(
      `SELECT id FROM organizations WHERE id IN ('org_a','org_b') ORDER BY id`,
    );
    expect(rows.map((r) => r.id)).toEqual(['org_a', 'org_b']);
  });

  it('serializes many concurrent writes', async () => {
    const client = await SqlJsClient.createInMemory();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        client.withTransaction(async () => {
          await client.execute(
            `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)`,
            [`org_c_${i}`, `N${i}`, '2026-01-01'],
          );
        }),
      ),
    );
    const rows = await client.select<{ id: string }>(
      `SELECT id FROM organizations WHERE id LIKE 'org_c_%'`,
    );
    expect(rows).toHaveLength(12);
  });
});

describe('busy retry helpers', () => {
  it('isSqliteBusyError matches common lock messages', () => {
    expect(isSqliteBusyError(new Error('database is locked'))).toBe(true);
    expect(
      isSqliteBusyError(
        new Error('cannot start a transaction within a transaction'),
      ),
    ).toBe(true);
    expect(isSqliteBusyError(new Error('permission denied'))).toBe(false);
    expect(isSqliteBusyError(new Error('code: 50'))).toBe(false);
    expect(isSqliteBusyError(new Error('HTTP code: 500'))).toBe(false);
    expect(isSqliteBusyError(new Error('error code: 5'))).toBe(true);
    expect(isSqliteBusyError(new Error('code: 5'))).toBe(true);
  });

  it('withSqliteBusyRetry eventually succeeds', async () => {
    let n = 0;
    const v = await withSqliteBusyRetry(
      async () => {
        n += 1;
        if (n < 3) throw new Error('database is locked');
        return 42;
      },
      { retries: 5, baseMs: 1 },
    );
    expect(v).toBe(42);
    expect(n).toBe(3);
  });

  it('formatPersistError is a complete message without needing UI prefix', () => {
    const busy = formatPersistError(new Error('database is locked'));
    expect(busy).toMatch(/保存|繁忙|重试/);
    expect(busy.startsWith('保存失败：保存失败')).toBe(false);
    const generic = formatPersistError(new Error('boom'));
    expect(generic).toBe('保存失败：boom');
  });
});
