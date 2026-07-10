import { describe, expect, it } from 'vitest';
import {
  InstanceLockBusyError,
  acquireInstanceLock,
  createMemoryLockFs,
  DEFAULT_LOCK_FILE_NAME,
} from './instance-lock';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('instance lock (memory fs)', () => {
  it('second acquire fails while first holds', async () => {
    const fs = createMemoryLockFs();
    const path = `/tmp/${DEFAULT_LOCK_FILE_NAME}`;
    const h1 = await acquireInstanceLock(path, fs);
    expect(fs.held.has(path)).toBe(true);

    await expect(acquireInstanceLock(path, fs)).rejects.toBeInstanceOf(
      InstanceLockBusyError,
    );

    await h1.release();
    const h2 = await acquireInstanceLock(path, fs);
    expect(fs.held.has(path)).toBe(true);
    await h2.release();
  });
});

describe('instance lock shipped in Tauri entry', () => {
  it('lib.rs setup calls acquire_lock_for_app / instance lock', () => {
    const root = join(process.cwd(), 'src-tauri', 'src');
    const lib = readFileSync(join(root, 'lib.rs'), 'utf8');
    const lock = readFileSync(join(root, 'instance_lock.rs'), 'utf8');
    expect(lib).toMatch(/acquire_lock_for_app/);
    expect(lib).toMatch(/instance_lock/);
    expect(lock).toMatch(/dude-tax\.lock/);
    expect(lock).toMatch(/share_mode\(0\)/);
    expect(existsSync(join(root, 'instance_lock.rs'))).toBe(true);
  });
});
