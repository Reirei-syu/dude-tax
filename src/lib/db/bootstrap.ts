/**
 * 应用启动：选择 Tauri SQLite 或 sql.js + localStorage（Web 开发回退）
 */

import { DEFAULT_TAURI_DB_URL, TaxRepository } from './repository';

const TAURI_DB_NAME = 'dude-tax.db';
const TAURI_DB_URL = DEFAULT_TAURI_DB_URL;

export const LS_DB_KEY = 'taxopt-helper-db';
export const LS_LAST_WS = 'taxopt-helper-last-ws';
export const LS_MIGRATED_KEY = 'taxopt-helper-migrated-v1';

export type PersistMode = 'tauri' | 'web';

export interface OpenRepositoryResult {
  repo: TaxRepository;
  mode: PersistMode;
  /** 人类可读的库位置说明 */
  dbPathHint: string;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri 2
  if ('__TAURI_INTERNALS__' in window) return true;
  // Vite env when built with Tauri CLI
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env;
    if (env?.TAURI_ENV_PLATFORM || env?.TAURI_PLATFORM) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function encodeBytesToLocalStorage(bytes: Uint8Array): void {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  localStorage.setItem(LS_DB_KEY, btoa(s));
}

function decodeBytesFromLocalStorage(): Uint8Array | null {
  try {
    const saved = localStorage.getItem(LS_DB_KEY);
    if (!saved) return null;
    return Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * 将当前仓库状态写入 localStorage（仅 Web 回退）
 */
export function persistWebDb(repo: TaxRepository): void {
  try {
    const bytes = repo.exportBytes();
    if (!bytes) return;
    encodeBytesToLocalStorage(bytes);
  } catch (e) {
    console.error('localStorage 持久化失败', e);
    throw e;
  }
}

/**
 * 打开应用仓库。
 * - Tauri：sqlite:dude-tax.db（AppConfig 目录）
 * - Web：sql.js 内存 + localStorage 整库快照
 */
export async function openAppRepository(): Promise<OpenRepositoryResult> {
  if (isTauriRuntime()) {
    const repo = await TaxRepository.openTauri(TAURI_DB_URL);
    await maybeMigrateLocalStorageToTauri(repo);
    let dbPathHint = `${TAURI_DB_NAME}（应用配置目录 AppConfig）`;
    try {
      const { appConfigDir, join } = await import('@tauri-apps/api/path');
      const dir = await appConfigDir();
      dbPathHint = await join(dir, TAURI_DB_NAME);
    } catch {
      /* path API 不可用时保留简短提示 */
    }
    return { repo, mode: 'tauri', dbPathHint };
  }

  const bytes = decodeBytesFromLocalStorage();
  const repo = bytes
    ? await TaxRepository.createFromBytes(bytes)
    : await TaxRepository.createInMemory();

  // 劫持：每次 snapshot 后写回 localStorage（Web 开发）
  const orig = repo.saveSnapshot.bind(repo);
  repo.saveSnapshot = async (snap) => {
    await orig(snap);
    try {
      persistWebDb(repo);
    } catch {
      /* quota — 调用方可 toast */
    }
  };

  return {
    repo,
    mode: 'web',
    dbPathHint: '浏览器 localStorage（开发回退，非正式）',
  };
}

/**
 * 首次 Tauri 启动：若真库为空且 localStorage 有旧数据，则导入
 */
async function maybeMigrateLocalStorageToTauri(
  repo: TaxRepository,
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(LS_MIGRATED_KEY) === '1') return;
    const list = await repo.listWorkspaces();
    if (list.length > 0) {
      localStorage.setItem(LS_MIGRATED_KEY, '1');
      return;
    }
    const bytes = decodeBytesFromLocalStorage();
    if (!bytes || bytes.length < 16) {
      localStorage.setItem(LS_MIGRATED_KEY, '1');
      return;
    }
    const legacy = await TaxRepository.createFromBytes(bytes);
    const workspaces = await legacy.listWorkspaces();
    for (const w of workspaces) {
      const snap = await legacy.loadWorkspace(w.id);
      if (snap) await repo.saveSnapshot(snap);
    }
    localStorage.setItem(LS_MIGRATED_KEY, '1');
  } catch (e) {
    console.warn('localStorage → SQLite 迁移跳过', e);
  }
}

export function rememberWorkspaceId(id: string): void {
  try {
    localStorage.setItem(LS_LAST_WS, id);
  } catch {
    /* ignore */
  }
}

export function readLastWorkspaceId(): string | null {
  try {
    return localStorage.getItem(LS_LAST_WS);
  } catch {
    return null;
  }
}
