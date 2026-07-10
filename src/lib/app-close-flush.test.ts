import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Tauri close path awaits flush', () => {
  it('App.tsx close handler flushes then always destroys (no stuck on save fail)', () => {
    const appPath = join(process.cwd(), 'src', 'App.tsx');
    const src = readFileSync(appPath, 'utf8');
    expect(src).toMatch(/onCloseRequested/);
    expect(src).toMatch(/preventDefault/);
    expect(src).toMatch(/flushPersist/);
    expect(src).toMatch(/destroy\(\)/);
    // 防重入：二次 CloseRequested 不再 preventDefault 卡死
    expect(src).toMatch(/closing/);
    // 超时兜底，避免 flush 挂死导致关不掉
    expect(src).toMatch(/flushWithTimeout|8_000|8000/);
  });
});
