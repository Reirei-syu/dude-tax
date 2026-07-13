import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createIsolatedStoreState,
  useTaxStore,
} from './store/useTaxStore';
import { TaxRepository } from './db/repository';

/**
 * 模拟 App 中「创建单位后是否允许关弹窗」的决策（与 onClose / setOrgManagerOpen 契约一致）。
 * 使用 store 当前 organization，不用 render 闭包。
 */
export function shouldAllowCloseOrgManager(): boolean {
  return useTaxStore.getState().organization != null;
}

describe('empty first-run onboarding', () => {
  it('enterEmptyState has no org, workspace, or employees', () => {
    createIsolatedStoreState();
    useTaxStore.getState().enterEmptyState();
    const s = useTaxStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.organization).toBeNull();
    expect(s.workspace).toBeNull();
    expect(s.employees).toEqual({});
    expect(s.selectedEmployeeId).toBeNull();
  });

  it('creating organization does not seed sample employees', async () => {
    const repo = await TaxRepository.createInMemory();
    const org = await repo.createOrganization('干净单位');
    await repo.ensureOrgAndWorkspace(org.name, 2026);
    const list = await repo.listWorkspaces();
    expect(list).toHaveLength(1);
    const snap = await repo.loadWorkspace(list[0]!.id);
    expect(snap).not.toBeNull();
    expect(snap!.employees).toEqual([]);
    expect(Object.keys(snap!.monthlyRecords)).toHaveLength(0);
  });

  it('new workspace board layout seeds viewport with defaults', async () => {
    const repo = await TaxRepository.createInMemory();
    const org = await repo.createOrganization('视口单位');
    const { workspace: ws } = await repo.ensureOrgAndWorkspace(org.name, 2026);
    const snap = await repo.loadWorkspace(ws.id);
    expect(snap).not.toBeNull();
    expect(snap!.boardLayout.viewport).toBeDefined();
    expect(snap!.boardLayout.viewport!.zoom).toBeGreaterThan(0);
    expect(snap!.boardLayout.nodes.length).toBeGreaterThanOrEqual(6);
  });

  it('App boot no longer auto-creates 默认单位', () => {
    const src = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(src).toMatch(/enterEmptyState/);
    expect(src).toMatch(/requireCreate/);
    expect(src).toMatch(/empty-org-guide/);
    expect(src).not.toMatch(
      /bootstrapDefault\(\s*['"]默认单位['"]/,
    );
    expect(src).not.toMatch(/addEmployee\(\s*['"]示例员工['"]\s*\)/);
    // 父级 hydrate 后关弹窗 + onClose 读 getState
    expect(src).toMatch(/setOrgManagerOpen\(false\)/);
    expect(src).toMatch(
      /useTaxStore\.getState\(\)\.organization/,
    );
  });

  it('OrgManager does not call onClose after create (parent closes)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/common/OrgManagerModal.tsx'),
      'utf8',
    );
    expect(src).toMatch(/await onOrgsChanged\(/);
    // 创建路径上不得再 if (requireCreate) onClose()
    const handleAdd = src.slice(
      src.indexOf('const handleAdd'),
      src.indexOf('const confirmDelete'),
    );
    expect(handleAdd).not.toMatch(/if \(requireCreate\) onClose/);
  });

  /**
   * 行为契约：空状态 → 创建单位并 hydrate 后，应允许关闭单位管理弹窗。
   * 复现旧 bug：hydrate 后仍用闭包 organization=null 则 would re-open。
   */
  it('after create+hydrate, close is allowed via store organization', async () => {
    createIsolatedStoreState();
    useTaxStore.getState().enterEmptyState();
    expect(shouldAllowCloseOrgManager()).toBe(false);

    const repo = await TaxRepository.createInMemory();
    useTaxStore.getState().setRepo(repo);

    // 与 handleOrgsChanged(newOrgId) 相同路径
    const org = await repo.createOrganization('行为单位');
    const { workspace } = await repo.ensureOrgAndWorkspace(org.name, 2026);
    const snap = await repo.loadWorkspace(workspace.id);
    expect(snap).not.toBeNull();
    useTaxStore.getState().switchWorkspaceSnapshot(snap!);

    expect(useTaxStore.getState().organization?.name).toBe('行为单位');
    expect(shouldAllowCloseOrgManager()).toBe(true);

    // 模拟父级 onClose：仅用 getState，不用陈旧 render 闭包
    let orgManagerOpen = true;
    const onClose = () => {
      if (!useTaxStore.getState().organization) {
        orgManagerOpen = true;
        return;
      }
      orgManagerOpen = false;
    };
    // 父级在 hydrate 后主动关闭
    orgManagerOpen = false;
    // 即使用户再点 onClose，也不应被强制打开
    onClose();
    expect(orgManagerOpen).toBe(false);
  });
});
