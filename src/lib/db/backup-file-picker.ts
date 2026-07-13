/**
 * 备份文件读写：Tauri 下用系统对话框自选路径；Web 回退浏览器下载 / input[type=file]
 */

import {
  BACKUP_FILE_EXT,
  downloadBackupFile,
} from './backup';
import { isTauriRuntime } from './bootstrap';

export type PickedBackupFile = {
  /** 显示名（文件名或完整路径） */
  name: string;
  bytes: Uint8Array;
};

/**
 * 导出：弹出「另存为」选路径并写入。
 * @returns 保存路径/文件名；用户取消返回 null
 */
export async function saveBackupWithPicker(
  bytes: Uint8Array,
  defaultFilename: string,
): Promise<string | null> {
  if (isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      title: '导出 Dude Tax 备份',
      defaultPath: defaultFilename,
      filters: [
        {
          name: 'Dude Tax 备份',
          extensions: ['dude-tax-backup', 'json'],
        },
      ],
    });
    if (!path) return null;
    // 确保扩展名
    let finalPath = path;
    const lower = path.toLowerCase();
    if (
      !lower.endsWith('.dude-tax-backup') &&
      !lower.endsWith('.json')
    ) {
      finalPath = `${path}${BACKUP_FILE_EXT}`;
    }
    await writeFile(finalPath, bytes);
    return finalPath;
  }

  // Web：无法指定任意路径，走浏览器下载（用户可在下载对话框改位置）
  downloadBackupFile(defaultFilename, bytes);
  return defaultFilename;
}

/**
 * 恢复：弹出「打开文件」选择备份。
 * @returns 文件名 + 字节；取消返回 null
 */
export async function pickBackupFileWithPicker(): Promise<PickedBackupFile | null> {
  if (isTauriRuntime()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const selected = await open({
      title: '选择 Dude Tax 备份文件',
      multiple: false,
      filters: [
        {
          name: 'Dude Tax 备份',
          extensions: ['dude-tax-backup', 'json'],
        },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (!selected) return null;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return null;
    const data = await readFile(path);
    const bytes =
      data instanceof Uint8Array ? data : new Uint8Array(data);
    const name = path.replace(/^.*[/\\]/, '') || path;
    return { name, bytes };
  }

  // Web：由调用方用 <input type="file"> 兜底
  return null;
}

/** 是否可用系统级「另存为 / 打开」对话框（Tauri） */
export function canUseNativeBackupPicker(): boolean {
  return isTauriRuntime();
}
