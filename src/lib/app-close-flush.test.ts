import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Tauri close path awaits flush', () => {
  it('App.tsx registers onCloseRequested with preventDefault and flushPersist', () => {
    const appPath = join(process.cwd(), 'src', 'App.tsx');
    const src = readFileSync(appPath, 'utf8');
    expect(src).toMatch(/onCloseRequested/);
    expect(src).toMatch(/preventDefault/);
    expect(src).toMatch(/flushPersist/);
    expect(src).toMatch(/destroy\(\)/);
  });
});
