import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calculator, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { TaxCanvas } from './components/canvas/TaxCanvas';
import { ConfirmModal } from './components/common/ConfirmModal';
import { OrgManagerModal } from './components/common/OrgManagerModal';
import { YearSelector } from './components/common/YearSelector';
import {
  openAppRepository,
  readLastWorkspaceId,
  rememberWorkspaceId,
  type PersistMode,
} from './lib/db/bootstrap';
import { TaxRepository } from './lib/db/repository';
import { useTaxStore } from './lib/store/useTaxStore';
import { POLICY_VERSION_BANNER } from './lib/tax/brackets';

export default function App() {
  const hydrated = useTaxStore((s) => s.hydrated);
  const organization = useTaxStore((s) => s.organization);
  const workspace = useTaxStore((s) => s.workspace);
  const lastPersistError = useTaxStore((s) => s.lastPersistError);
  const setRepo = useTaxStore((s) => s.setRepo);
  const hydrateFromSnapshot = useTaxStore((s) => s.hydrateFromSnapshot);
  const bootstrapDefault = useTaxStore((s) => s.bootstrapDefault);
  const switchWorkspaceSnapshot = useTaxStore((s) => s.switchWorkspaceSnapshot);
  const resetBoardLayout = useTaxStore((s) => s.resetBoardLayout);
  const saveCurrentLayoutAsDefault = useTaxStore(
    (s) => s.saveCurrentLayoutAsDefault,
  );
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; orgId: string; orgName: string; year: number }>
  >([]);
  const [repo, setLocalRepo] = useState<TaxRepository | null>(null);
  const [persistMode, setPersistMode] = useState<PersistMode>('web');
  const [dbPathHint, setDbPathHint] = useState('');
  const [orgManagerOpen, setOrgManagerOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const refreshWorkspaceList = useCallback(async (r: TaxRepository) => {
    setWorkspaces(await r.listWorkspaces());
  }, []);

  const orgYears = useMemo(() => {
    if (!organization) return [] as number[];
    return workspaces
      .filter((w) => w.orgId === organization.id)
      .map((w) => w.year)
      .sort((a, b) => b - a);
  }, [workspaces, organization]);

  const maxOrgYear = orgYears.length > 0 ? orgYears[0]! : null;
  const nextYearToCreate = maxOrgYear != null ? maxOrgYear + 1 : null;

  const orgOptions = useMemo(() => {
    const map = new Map<string, { orgId: string; orgName: string }>();
    for (const w of workspaces) {
      if (!map.has(w.orgId)) {
        map.set(w.orgId, { orgId: w.orgId, orgName: w.orgName });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.orgName.localeCompare(b.orgName, 'zh'),
    );
  }, [workspaces]);

  const switchToWorkspace = useCallback(
    async (wsId: string, toastText?: string) => {
      if (!repo) return false;
      await useTaxStore.getState().flushPersist();
      const snap = await repo.loadWorkspace(wsId);
      if (!snap) return false;
      switchWorkspaceSnapshot(snap);
      rememberWorkspaceId(wsId);
      await refreshWorkspaceList(repo);
      if (toastText) toast.message(toastText);
      return true;
    },
    [repo, switchWorkspaceSnapshot, refreshWorkspaceList],
  );

  const handleSelectExistingYear = useCallback(
    async (year: number) => {
      if (!repo || !organization) return;
      if (workspace?.year === year) return;
      if (!orgYears.includes(year)) {
        toast.error(`${year} 年工作区不存在`);
        return;
      }
      await useTaxStore.getState().flushPersist();
      const list = (await repo.listWorkspaces()).filter(
        (w) => w.orgId === organization.id && w.year === year,
      );
      const ws = list[0];
      if (!ws) {
        toast.error('无法打开该年度工作区');
        return;
      }
      const snap = await repo.loadWorkspace(ws.id);
      if (!snap) {
        toast.error('无法加载该年度数据');
        return;
      }
      switchWorkspaceSnapshot(snap);
      rememberWorkspaceId(ws.id);
      await refreshWorkspaceList(repo);
      toast.message(`已切换到 ${year} 年`);
    },
    [
      repo,
      organization,
      workspace?.year,
      orgYears,
      switchWorkspaceSnapshot,
      refreshWorkspaceList,
    ],
  );

  const handleCreateNextYear = useCallback(async () => {
    if (!repo || !organization || maxOrgYear == null) {
      toast.error('无法新建年度');
      return;
    }
    await useTaxStore.getState().flushPersist();
    const result = await repo.createNextYearWithInherit(
      organization,
      maxOrgYear,
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const snap = await repo.loadWorkspace(result.workspace.id);
    if (!snap) {
      toast.error('新建年度成功但加载失败');
      await refreshWorkspaceList(repo);
      return;
    }
    switchWorkspaceSnapshot(snap);
    rememberWorkspaceId(result.workspace.id);
    await refreshWorkspaceList(repo);
    const skipHint =
      result.skippedEmployeeCount > 0
        ? `，跳过已离职 ${result.skippedEmployeeCount} 人`
        : '';
    toast.success(
      `已新建 ${result.nextYear} 年，继承在职 ${result.inheritedEmployeeCount} 人及期末工资明细${skipHint}`,
    );
  }, [
    repo,
    organization,
    maxOrgYear,
    switchWorkspaceSnapshot,
    refreshWorkspaceList,
  ]);

  const handleOrgChange = useCallback(
    async (orgId: string) => {
      if (!repo || !organization || orgId === organization.id) return;
      const targetYear = workspace?.year ?? new Date().getFullYear();
      const list = (await repo.listWorkspaces()).filter((w) => w.orgId === orgId);
      if (list.length === 0) return;
      const sameYear = list.find((w) => w.year === targetYear);
      const pick = sameYear ?? list[0]!;
      await switchToWorkspace(
        pick.id,
        `已切换到 ${pick.orgName} · ${pick.year} 年`,
      );
    },
    [repo, organization, workspace?.year, switchToWorkspace],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openAppRepository();
        if (cancelled) return;
        const r = opened.repo;
        setLocalRepo(r);
        setRepo(r);
        setPersistMode(opened.mode);
        setDbPathHint(opened.dbPathHint);

        const list = await r.listWorkspaces();
        setWorkspaces(list);
        if (list.length > 0) {
          let targetId = list[0]!.id;
          const last = readLastWorkspaceId();
          if (last && list.some((w) => w.id === last)) targetId = last;
          const snap = await r.loadWorkspace(targetId);
          if (snap) {
            hydrateFromSnapshot(snap);
            rememberWorkspaceId(snap.workspace.id);
            return;
          }
        }
        bootstrapDefault('默认单位', new Date().getFullYear());
        await useTaxStore.getState().persistNow();
        setWorkspaces(await r.listWorkspaces());
        const wsId = useTaxStore.getState().workspace?.id;
        if (wsId) rememberWorkspaceId(wsId);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('另一个 Dude Tax') || msg.includes('实例')) {
          toast.error(msg);
          return;
        }
        // 不进入「无 repo 可编辑」空壳：hydrate 失败则保持加载失败态
        toast.error(
          `本地数据库初始化失败：${msg || '未知错误'}。请重启应用或检查磁盘权限。`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setRepo, hydrateFromSnapshot, bootstrapDefault]);

  // 关闭 / 刷新 / 切走页面前尽量刷写；Tauri 关窗会 await 落盘
  useEffect(() => {
    const flush = () => {
      void useTaxStore.getState().flushPersist().catch(() => {
        /* ignore */
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);

    let unlistenClose: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (cancelled) return;
        const win = getCurrentWindow();
        unlistenClose = await win.onCloseRequested(async (event) => {
          // 阻止默认关闭，先 await 落盘再销毁
          event.preventDefault();
          try {
            await useTaxStore.getState().flushPersist();
          } catch (e) {
            console.error('close flush failed', e);
            toast.error('保存失败，请重试关闭或检查磁盘');
            return;
          }
          await win.destroy();
        });
      } catch {
        /* 非 Tauri 环境：仅浏览器事件 */
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      unlistenClose?.();
      flush();
    };
  }, []);

  useEffect(() => {
    if (lastPersistError) {
      toast.error(`保存失败：${lastPersistError}`);
    }
  }, [lastPersistError]);

  const handleOrgsChanged = async (opts?: {
    deletedCurrent?: boolean;
    newOrgId?: string;
    newOrgYear?: number;
  }) => {
    if (!repo) return;
    await refreshWorkspaceList(repo);

    if (opts?.deletedCurrent) {
      const list = await repo.listWorkspaces();
      if (list.length > 0) {
        const snap = await repo.loadWorkspace(list[0]!.id);
        if (snap) {
          switchWorkspaceSnapshot(snap);
          rememberWorkspaceId(snap.workspace.id);
          toast.message(
            `已切换到 ${snap.organization.name} · ${snap.workspace.year}`,
          );
          return;
        }
      }
      const orgs = await repo.listOrganizations();
      if (orgs.length > 0) {
        const { organization: org, workspace: ws } =
          await repo.ensureOrgAndWorkspace(
            orgs[0]!.name,
            new Date().getFullYear(),
          );
        useTaxStore.setState({
          organization: org,
          workspace: ws,
          employees: {},
          monthlyRecords: {},
          bonusRecords: {},
          boardLayout: { nodes: [] },
          selectedEmployeeId: null,
          pendingConfirm: null,
          statusBanner: null,
          hydrated: true,
        });
        useTaxStore.getState().resetBoardLayout();
        useTaxStore.getState().addEmployee('示例员工');
        await useTaxStore.getState().persistNow();
        rememberWorkspaceId(ws.id);
        await refreshWorkspaceList(repo);
        toast.message(`已切换到 ${org.name}`);
      }
    }

    if (opts?.newOrgId) {
      const year = opts.newOrgYear ?? new Date().getFullYear();
      const list = (await repo.listWorkspaces()).filter(
        (w) => w.orgId === opts.newOrgId,
      );
      const pick =
        list.find((w) => w.year === year) ??
        list.sort((a, b) => b.year - a.year)[0];
      if (pick) {
        const snap = await repo.loadWorkspace(pick.id);
        if (snap) {
          await useTaxStore.getState().flushPersist();
          switchWorkspaceSnapshot(snap);
          rememberWorkspaceId(pick.id);
          await refreshWorkspaceList(repo);
          toast.success(
            `已添加「${snap.organization.name}」并启用 ${snap.workspace.year} 年`,
          );
          return;
        }
      }
      toast.success('单位已添加');
    }
  };

  const handleNeedBootstrap = async () => {
    if (!repo) {
      bootstrapDefault();
      return;
    }
    bootstrapDefault('默认单位', new Date().getFullYear());
    await useTaxStore.getState().persistNow();
    await refreshWorkspaceList(repo);
    toast.message('已重建默认单位');
  };

  const copyDbPath = async () => {
    if (!dbPathHint) return;
    try {
      await navigator.clipboard.writeText(dbPathHint);
      toast.success('已复制数据库路径');
    } catch {
      toast.message(dbPathHint);
    }
  };

  if (!hydrated) {
    return (
      <div className="app-loading">
        <div className="app-loading-dot" />
        <span>正在加载 Dude Tax…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div
        className={`app-nav-wrap ${navCollapsed ? 'is-collapsed' : ''}`}
      >
        <header className="app-header" aria-hidden={navCollapsed}>
          <div className="app-brand">
            <div className="app-logo" aria-hidden>
              <Calculator size={16} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="app-title">Dude Tax</h1>
              <p className="app-policy">{POLICY_VERSION_BANNER}</p>
            </div>
          </div>

          <div className="app-divider hidden sm:block" />

          <span className="workspace-chip" title="当前单位">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span className="truncate max-w-[8rem] sm:max-w-[12rem]">
              {organization?.name ?? '—'}
            </span>
          </span>

          <YearSelector
            years={orgYears}
            selectedYear={workspace?.year ?? null}
            nextYearToCreate={nextYearToCreate}
            maxOrgYear={maxOrgYear}
            disabled={!organization || orgYears.length === 0}
            tabIndex={navCollapsed ? -1 : 0}
            onSelectYear={(y) => {
              void handleSelectExistingYear(y);
            }}
            onCreateNextYear={() => {
              void handleCreateNextYear();
            }}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setOrgManagerOpen(true)}
            title="添加或删除单位"
            tabIndex={navCollapsed ? -1 : 0}
          >
            <Building2 size={14} />
            单位管理
          </button>

          {orgOptions.length > 1 && (
            <select
              className="field max-w-[10rem]"
              value={organization?.id ?? ''}
              title="切换单位"
              aria-label="切换单位"
              tabIndex={navCollapsed ? -1 : 0}
              onChange={(e) => {
                void handleOrgChange(e.target.value);
              }}
            >
              {orgOptions.map((o) => (
                <option key={o.orgId} value={o.orgId}>
                  {o.orgName}
                </option>
              ))}
            </select>
          )}

          <div className="app-divider hidden md:block" />

          <div className="nav-canvas-tools">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              title="将当前卡片位置、大小与画布缩放保存为默认，之后「恢复默认布局」即回到此状态"
              onClick={() => {
                try {
                  saveCurrentLayoutAsDefault();
                  toast.success('已保存当前布局为默认');
                } catch {
                  toast.error('保存默认布局失败');
                }
              }}
            >
              保存当前布局为默认
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              onClick={() => {
                resetBoardLayout();
                toast.message('已恢复默认布局');
              }}
            >
              恢复默认布局
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              title={
                persistMode === 'tauri'
                  ? `SQLite 文件：${dbPathHint}\n点击复制路径，退出后可复制该文件备份`
                  : `当前为 Web 回退模式：${dbPathHint}`
              }
              onClick={() => {
                void copyDbPath();
              }}
            >
              <Database size={14} />
              {persistMode === 'tauri' ? '数据位置' : 'Web 存储'}
            </button>
            <span className="nav-canvas-hint">
              空白处拖动平移 · 空格+拖动可从卡片上平移 · 悬停边缘调大小 · 拖卡片移动
            </span>
          </div>

          <div className="app-disclaimer hidden xl:block">
            仅供参考，请以税务机关官方计算器与最终汇算为准
          </div>
        </header>

        <button
          type="button"
          className="nav-edge-toggle"
          onClick={() => setNavCollapsed((v) => !v)}
          title={navCollapsed ? '展开导航区' : '收起导航区'}
          aria-label={navCollapsed ? '展开导航区' : '收起导航区'}
          aria-expanded={!navCollapsed}
        >
          {navCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <main className="min-h-0 flex-1">
        <TaxCanvas />
      </main>

      <ConfirmModal />
      <OrgManagerModal
        open={orgManagerOpen}
        onClose={() => setOrgManagerOpen(false)}
        repo={repo}
        currentOrgId={organization?.id ?? null}
        defaultYear={workspace?.year ?? new Date().getFullYear()}
        onOrgsChanged={(opts) => {
          void handleOrgsChanged(opts);
        }}
        onNeedBootstrap={() => {
          void handleNeedBootstrap();
        }}
      />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
