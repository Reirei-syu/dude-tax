/**
 * 全量数据备份 / 恢复（JSON 包，经真实 TaxRepository 读写）
 * 格式与 UI、单测共用同一 encode/decode/restore 入口。
 */

import type { TaxRepository, WorkspaceSnapshot } from './repository';

export const BACKUP_FORMAT = 'dude-tax-backup' as const;
export const BACKUP_VERSION = 1 as const;
export const BACKUP_FILE_EXT = '.dude-tax-backup';

export interface DudeTaxBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  snapshots: WorkspaceSnapshot[];
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

/** 从仓库收集全部工作区快照 */
export async function collectFullBackup(
  repo: TaxRepository,
): Promise<DudeTaxBackup> {
  const list = await repo.listWorkspaces();
  const snapshots: WorkspaceSnapshot[] = [];
  for (const w of list) {
    const snap = await repo.loadWorkspace(w.id);
    if (snap) snapshots.push(snap);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    snapshots,
  };
}

/** 编码为 UTF-8 字节（可下载 / 写文件） */
export function encodeBackup(payload: DudeTaxBackup): Uint8Array {
  const json = JSON.stringify(payload);
  return new TextEncoder().encode(json);
}

/** 解析并校验备份；非法内容抛 BackupFormatError（不触碰 live DB） */
export function decodeBackup(bytes: Uint8Array): DudeTaxBackup {
  if (!bytes || bytes.length < 8) {
    throw new BackupFormatError('备份文件为空或过短');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BackupFormatError('备份文件不是有效的 UTF-8 文本');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError('备份文件不是有效的 JSON');
  }
  if (!raw || typeof raw !== 'object') {
    throw new BackupFormatError('备份根对象无效');
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('不是 Dude Tax 备份格式');
  }
  if (o.version !== BACKUP_VERSION) {
    throw new BackupFormatError(`不支持的备份版本：${String(o.version)}`);
  }
  if (!Array.isArray(o.snapshots)) {
    throw new BackupFormatError('备份缺少 snapshots 数组');
  }
  for (let i = 0; i < o.snapshots.length; i++) {
    validateSnapshot(o.snapshots[i], i);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt:
      typeof o.exportedAt === 'string'
        ? o.exportedAt
        : new Date().toISOString(),
    snapshots: o.snapshots as WorkspaceSnapshot[],
  };
}

function validateSnapshot(s: unknown, index: number): void {
  if (!s || typeof s !== 'object') {
    throw new BackupFormatError(`快照 #${index} 无效`);
  }
  const snap = s as Record<string, unknown>;
  if (!snap.organization || typeof snap.organization !== 'object') {
    throw new BackupFormatError(`快照 #${index} 缺少 organization`);
  }
  if (!snap.workspace || typeof snap.workspace !== 'object') {
    throw new BackupFormatError(`快照 #${index} 缺少 workspace`);
  }
  const ws = snap.workspace as Record<string, unknown>;
  if (typeof ws.id !== 'string' || typeof ws.year !== 'number') {
    throw new BackupFormatError(`快照 #${index} workspace 字段不完整`);
  }
  if (!Array.isArray(snap.employees)) {
    throw new BackupFormatError(`快照 #${index} 缺少 employees`);
  }
  if (!snap.monthlyRecords || typeof snap.monthlyRecords !== 'object') {
    throw new BackupFormatError(`快照 #${index} 缺少 monthlyRecords`);
  }
  if (!snap.bonusRecords || typeof snap.bonusRecords !== 'object') {
    throw new BackupFormatError(`快照 #${index} 缺少 bonusRecords`);
  }
  if (!snap.boardLayout || typeof snap.boardLayout !== 'object') {
    throw new BackupFormatError(`快照 #${index} 缺少 boardLayout`);
  }
}

/**
 * 用备份内容完整替换仓库数据（事务内：先清后写）。
 * 调用前须已 decode 成功；失败时事务回滚。
 */
export async function restoreFullBackup(
  repo: TaxRepository,
  payload: DudeTaxBackup,
): Promise<void> {
  await repo.replaceAllSnapshots(payload.snapshots);
}

/** 导出：收集 + 编码 */
export async function exportBackupBytes(
  repo: TaxRepository,
): Promise<Uint8Array> {
  const payload = await collectFullBackup(repo);
  return encodeBackup(payload);
}

/** 从字节恢复（先校验再写库） */
export async function restoreBackupBytes(
  repo: TaxRepository,
  bytes: Uint8Array,
): Promise<DudeTaxBackup> {
  const payload = decodeBackup(bytes);
  await restoreFullBackup(repo, payload);
  return payload;
}

export function buildBackupFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `DudeTax备份_${y}${m}${d}_${hh}${mm}${BACKUP_FILE_EXT}`;
}

/** 浏览器 / WebView 下载备份文件 */
export function downloadBackupFile(filename: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
