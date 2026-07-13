import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Trash2, X } from 'lucide-react';
import type { Organization } from '../../types';
import type { TaxRepository } from '../../lib/db/repository';

export type OrgListItem = Organization & { workspaceCount: number };

/** 新建单位时可选启用年份列表（当前年 ± 范围） */
function buildEnableYearOptions(center?: number): number[] {
  const now = center ?? new Date().getFullYear();
  const years: number[] = [];
  for (let y = now + 1; y >= now - 6; y--) years.push(y);
  return years;
}

interface OrgManagerModalProps {
  open: boolean;
  onClose: () => void;
  repo: TaxRepository | null;
  currentOrgId: string | null;
  /** 默认启用年份（打开弹窗时预填） */
  defaultYear?: number;
  /**
   * 首次无单位：必须创建才能关闭；文案改为引导创建。
   * 创建成功后由父级关闭（onOrgsChanged 后）。
   */
  requireCreate?: boolean;
  onOrgsChanged: (opts?: {
    deletedCurrent?: boolean;
    newOrgId?: string;
    /** 新建单位时选用的启用年份 */
    newOrgYear?: number;
  }) => void | Promise<void>;
  /** 删除最后一个单位后：进入空状态并继续引导创建 */
  onNeedBootstrap: () => void;
}

export function OrgManagerModal({
  open,
  onClose,
  repo,
  currentOrgId,
  defaultYear,
  requireCreate = false,
  onOrgsChanged,
  onNeedBootstrap,
}: OrgManagerModalProps) {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [newName, setNewName] = useState('');
  const [enableYear, setEnableYear] = useState(
    () => defaultYear ?? new Date().getFullYear(),
  );
  const [pendingDelete, setPendingDelete] = useState<OrgListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => buildEnableYearOptions(defaultYear ?? new Date().getFullYear()),
    [defaultYear],
  );

  const refresh = async () => {
    if (!repo) {
      setOrgs([]);
      return;
    }
    setOrgs(await repo.listOrganizations());
  };

  useEffect(() => {
    if (open) {
      void refresh();
      setNewName('');
      setEnableYear(defaultYear ?? new Date().getFullYear());
      setPendingDelete(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repo, defaultYear]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!repo) return;
    const name = newName.trim();
    if (!name) {
      setError('请输入单位名称');
      return;
    }
    const year = Math.floor(Number(enableYear));
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      setError('请选择有效的启用年份');
      return;
    }
    const existed = orgs.some((o) => o.name === name);
    if (existed) {
      setError(`单位「${name}」已存在，请换名称或在导航栏切换年度`);
      return;
    }
    const org = await repo.createOrganization(name);
    // 按用户选择的启用年份创建首个工作区（无示例员工）
    await repo.ensureOrgAndWorkspace(org.name, year);
    setNewName('');
    setError(null);
    await refresh();
    // 父级 await hydrate 后自行 setOrgManagerOpen(false)；
    // 此处不再 onClose，避免 render 闭包里 organization=null 时又被强制打开
    await onOrgsChanged({ newOrgId: org.id, newOrgYear: year });
  };

  const confirmDelete = async () => {
    if (!repo || !pendingDelete) return;
    const id = pendingDelete.id;
    const wasCurrent = id === currentOrgId;
    await repo.deleteOrganization(id);
    setPendingDelete(null);
    const remaining = await repo.listOrganizations();
    setOrgs(remaining);
    if (remaining.length === 0) {
      onNeedBootstrap();
      return;
    }
    onOrgsChanged({ deletedCurrent: wasCurrent });
  };

  const tryClose = () => {
    if (requireCreate) {
      setError('请先创建单位名称并添加，才能开始使用');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
      <div
        className="modal-panel flex max-w-lg flex-col"
        style={{ maxHeight: 'min(80vh, 560px)' }}
      >
        <div className="modal-header shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Building2 size={16} />
            </span>
            <div>
              <h2 className="panel-title">
                {requireCreate ? '欢迎使用 Dude Tax' : '单位管理'}
              </h2>
              <p className="panel-subtitle">
                {requireCreate
                  ? '请先创建核算单位，再添加员工与工资'
                  : '添加或删除独立核算单位'}
              </p>
            </div>
          </div>
          {!requireCreate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={tryClose}
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="modal-body min-h-0 flex-1 overflow-auto">
          {requireCreate ? (
            <p className="mb-4 mt-0 text-xs leading-relaxed text-[var(--text-muted)]">
              首次使用需创建至少一个单位（如公司、工作室或团队名称）。创建后单位内
              <strong className="text-[var(--text)]"> 不会自动添加示例员工</strong>
              ，请到画布中的「员工花名册」模块自行新建员工。
            </p>
          ) : (
            <p className="mb-4 mt-0 text-xs leading-relaxed text-[var(--text-muted)]">
              每个单位可独立维护多年份工作区与员工数据。删除单位将清除其下全部工作区、员工与工资记录，且不可恢复。新建单位不会附带示例员工。
            </p>
          )}

          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  单位名称
                </span>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAdd();
                  }}
                  placeholder="请输入新单位名称"
                  className="field min-w-0 w-full"
                  aria-label="新单位名称"
                />
              </label>
              <label className="flex w-[7.5rem] shrink-0 flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  启用年份
                </span>
                <select
                  className="field w-full num"
                  value={enableYear}
                  aria-label="启用年份"
                  title="新建单位后首个工作区的纳税年度"
                  onChange={(e) => {
                    setEnableYear(parseInt(e.target.value, 10));
                    setError(null);
                  }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary shrink-0"
                onClick={() => {
                  void handleAdd();
                }}
              >
                <Plus size={15} /> 添加
              </button>
            </div>
            <p className="m-0 text-[10px] leading-relaxed text-[var(--text-faint)]">
              启用年份为该单位首个工作区年度；后续可在导航栏「年度」中切换或新建其它年份。
            </p>
          </div>
          {error && (
            <p className="mb-3 mt-0 text-xs text-[var(--danger)]">{error}</p>
          )}

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>单位名称</th>
                  <th className="text-center!">工作区</th>
                  <th className="text-right!">操作</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className={org.id === currentOrgId ? 'is-selected' : undefined}
                  >
                    <td className="font-medium text-[var(--text)]">
                      {org.name}
                      {org.id === currentOrgId && (
                        <span className="badge badge-soft ml-2">当前</span>
                      )}
                    </td>
                    <td className="num text-center text-[var(--text-muted)]">
                      {org.workspaceCount}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        onClick={() => setPendingDelete(org)}
                      >
                        <Trash2 size={13} /> 删除
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-10! text-center text-xs text-[var(--text-muted)]"
                    >
                      暂无单位，请先添加
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer shrink-0">
          <button type="button" className="btn btn-secondary" onClick={tryClose}>
            完成
          </button>
        </div>
      </div>

      {pendingDelete && (
        <div
          className="absolute inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(24, 24, 27, 0.35)' }}
        >
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h3 className="panel-title">确认删除单位？</h3>
            </div>
            <div className="modal-body">
              <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                即将删除「{pendingDelete.name}」及其下 {pendingDelete.workspaceCount}{' '}
                个工作区的全部员工与工资数据，此操作不可撤销。
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  void confirmDelete();
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
