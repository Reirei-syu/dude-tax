import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('navbar data-safety controls', () => {
  it('App.tsx exposes 立即保存 / 导出备份 / 从备份恢复 wired to real handlers', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    expect(src).toContain('立即保存');
    expect(src).toContain('导出备份');
    expect(src).toContain('从备份恢复');
    expect(src).toMatch(/handleForceSave/);
    expect(src).toMatch(/handleExportBackup/);
    expect(src).toMatch(/handleRestoreBackupFile/);
    expect(src).toMatch(/exportBackupBytes/);
    expect(src).toMatch(/restoreBackupBytes/);
    expect(src).toMatch(/flushPersist/);
  });
});
