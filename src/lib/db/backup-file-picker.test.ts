/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  canUseNativeBackupPicker,
  saveBackupWithPicker,
} from './backup-file-picker';

describe('saveBackupWithPicker web fallback', () => {
  beforeEach(() => {
    // 确保非 Tauri
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('web path downloads and returns default filename', async () => {
    expect(canUseNativeBackupPicker()).toBe(false);

    const click = vi.fn();
    const remove = vi.fn();
    const aEl = {
      href: '',
      download: '',
      rel: '',
      click,
      remove,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return aEl;
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    const name = 'DudeTax备份_test.dude-tax-backup';
    const bytes = new TextEncoder().encode('{"format":"dude-tax-backup"}');
    const result = await saveBackupWithPicker(bytes, name);
    expect(result).toBe(name);
    expect(click).toHaveBeenCalled();
  });
});
