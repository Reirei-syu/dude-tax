import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Tauri close path awaits flush', () => {
  it('App.tsx close handler flushes then force_quit (no stuck on save fail)', () => {
    const appPath = join(process.cwd(), 'src', 'App.tsx');
    const src = readFileSync(appPath, 'utf8');
    expect(src).toMatch(/onCloseRequested/);
    expect(src).toMatch(/preventDefault/);
    expect(src).toMatch(/flushPersist/);
    // 强制退出，避免 destroy 重入 CloseRequested 卡死
    expect(src).toMatch(/force_quit/);
    expect(src).toMatch(/closing/);
    // 超时兜底：≥ busy_timeout(8s)，不得单独用 3s 截断
    expect(src).toMatch(/12_000|12000|8_000|8000/);
    expect(src).not.toMatch(/forceQuitAfterFlush\(\s*3_000\s*\)/);
    // 导航退出按钮
    expect(src).toMatch(/退出/);
    expect(src).toMatch(/nav-exit-btn|exitAppRef/);
    // toast 不叠双重「保存失败：」
    expect(src).toMatch(/toast\.error\(\s*lastPersistError\s*\)/);
  });

  it('Rust exposes force_quit command', () => {
    const rust = readFileSync(
      join(process.cwd(), 'src-tauri', 'src', 'lib.rs'),
      'utf8',
    );
    expect(rust).toMatch(/fn force_quit/);
    expect(rust).toMatch(/app\.exit\(0\)/);
  });
});
