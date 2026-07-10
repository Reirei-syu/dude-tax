import { describe, expect, it } from 'vitest';
import { qmarkToDollar } from './sql-client';
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
});
