/**
 * 开发版与安装版使用不同 SQLite 文件名，避免共用同一库。
 * - 开发（vite/tauri dev）：dude-tax-dev.db
 * - 安装包/release：dude-tax.db
 */

/** 是否为前端开发构建（vite dev / tauri dev） */
export function isFrontendDevBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((import.meta as any).env?.DEV);
  } catch {
    return false;
  }
}

export function getTauriDbFileName(): string {
  return isFrontendDevBuild() ? 'dude-tax-dev.db' : 'dude-tax.db';
}

export function getTauriDbUrl(): string {
  return `sqlite:${getTauriDbFileName()}`;
}
