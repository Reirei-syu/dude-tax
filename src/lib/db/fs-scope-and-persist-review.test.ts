import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatPersistError } from './sql-client';

describe('review fixes: fs scope + toast composition', () => {
  it('capabilities fs:scope has no unrestricted ** path', () => {
    const raw = readFileSync(
      join(process.cwd(), 'src-tauri/capabilities/default.json'),
      'utf8',
    );
    const json = JSON.parse(raw) as {
      permissions: Array<string | { identifier?: string; allow?: Array<{ path?: string }> }>;
    };
    const scope = json.permissions.find(
      (p) => typeof p === 'object' && p.identifier === 'fs:scope',
    ) as { allow?: Array<{ path?: string }> } | undefined;
    expect(scope).toBeDefined();
    const paths = (scope!.allow ?? []).map((a) => a.path);
    expect(paths).not.toContain('**');
    // 不开放整盘 $HOME/**；备份走对话框动态授权 + 常见目录
    expect(paths.some((p) => p === '$HOME/**' || p === '$HOME')).toBe(false);
    expect(paths.some((p) => p?.includes('$DOCUMENT'))).toBe(true);
    expect(paths.some((p) => p?.includes('$DOWNLOAD'))).toBe(true);
    expect(paths.some((p) => p?.includes('$DESKTOP'))).toBe(true);
  });

  it('App toast does not double-prefix formatPersistError', () => {
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    // must toast the store message as-is
    expect(app).toMatch(/toast\.error\(\s*lastPersistError\s*\)/);
    expect(app).not.toMatch(
      /toast\.error\(\s*`保存失败：\$\{lastPersistError\}`\s*\)/,
    );
    const msg = formatPersistError(new Error('disk full'));
    // simulating UI: toast.error(msg) — not toast.error(`保存失败：${msg}`)
    expect(`保存失败：${msg}`).toMatch(/保存失败：保存失败/);
    expect(msg.startsWith('保存失败：保存失败')).toBe(false);
  });
});
