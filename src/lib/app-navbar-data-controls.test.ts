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
    expect(src).toMatch(/handleRestoreBackup/);
    expect(src).toMatch(/exportBackupBytes/);
    expect(src).toMatch(/restoreBackupBytes/);
    expect(src).toMatch(/saveBackupWithPicker/);
    expect(src).toMatch(/pickBackupFileWithPicker/);
    expect(src).toMatch(/flushPersist/);
  });
});

describe('backup file picker module', () => {
  it('exposes save and open pickers with web fallback', async () => {
    const src = readFileSync(
      join(process.cwd(), 'src/lib/db/backup-file-picker.ts'),
      'utf8',
    );
    expect(src).toMatch(/saveBackupWithPicker/);
    expect(src).toMatch(/pickBackupFileWithPicker/);
    expect(src).toMatch(/@tauri-apps\/plugin-dialog/);
    expect(src).toMatch(/@tauri-apps\/plugin-fs/);
    expect(src).toMatch(/downloadBackupFile/);
  });
});
