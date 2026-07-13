import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  HardDriveDownload,
  LogOut,
  Save,
  Upload,
} from 'lucide-react';
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
import {
  BackupFormatError,
  buildBackupFilename,
  exportBackupBytes,
  restoreBackupBytes,
} from './lib/db/backup';
import {
  canUseNativeBackupPicker,
  pickBackupFileWithPicker,
  saveBackupWithPicker,
} from './lib/db/backup-file-picker';
import { TaxRepository } from './lib/db/repository';
import { useTaxStore } from './lib/store/useTaxStore';
export default function App() {
  const hydrated = useTaxStore((s) => s.hydrated);
  const organization = useTaxStore((s) => s.organization);
  const workspace = useTaxStore((s) => s.workspace);
  const lastPersistError = useTaxStore((s) => s.lastPersistError);
  const setRepo = useTaxStore((s) => s.setRepo);
  const hydrateFromSnapshot = useTaxStore((s) => s.hydrateFromSnapshot);
  const enterEmptyState = useTaxStore((s) => s.enterEmptyState);
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
  const [dataBusy, setDataBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  /** 由关窗 effect 注入：落盘 + 强制退出 */
  const exitAppRef = useRef<(() => Promise<void>) | null>(null);

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
        // 无单位：干净空状态，引导用户自行创建（不建默认单位/示例员工）
        enterEmptyState();
        setOrgManagerOpen(true);
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
  }, [setRepo, hydrateFromSnapshot, enterEmptyState]);

  // 关闭 / 刷新 / 切走页面前尽量刷写；Tauri 关窗：落盘后 force_quit（避免 destroy 重入卡死）
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
    /** 正在执行退出：二次 CloseRequested 直接放行，不再 preventDefault */
    let closing = false;

    const flushWithTimeout = (ms: number) =>
      Promise.race([
        useTaxStore.getState().flushPersist().catch(() => {
          /* 落盘失败仍退出 */
        }),
        new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), ms);
        }),
      ]);

    /** 落盘后强制退出进程（dev/正式均可靠） */
    const forceQuitAfterFlush = async (timeoutMs: number) => {
      try {
        await flushWithTimeout(timeoutMs);
      } catch (e) {
        console.error('exit flush failed', e);
      }
      try {
        unlistenClose?.();
        unlistenClose = undefined;
      } catch {
        /* ignore */
      }
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('force_quit');
      } catch (e) {
        console.error('force_quit failed', e);
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
        } catch {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }
      }
    };

    // 供导航「退出」按钮调用
    // ≥ busy_timeout(8s) + 事务重试预算，避免未写完就 force_quit
    exitAppRef.current = () => forceQuitAfterFlush(12_000);

    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (cancelled) return;
        const win = getCurrentWindow();
        unlistenClose = await win.onCloseRequested(async (event) => {
          if (closing) {
            // 已在退出流程中：不再拦截，避免卡死
            return;
          }
          event.preventDefault();
          closing = true;
          await forceQuitAfterFlush(12_000);
        });
      } catch {
        /* 非 Tauri：Web 退出 */
        exitAppRef.current = async () => {
          try {
            await flushWithTimeout(2_000);
          } catch {
            /* ignore */
          }
          try {
            window.close();
          } catch {
            toast.message('请直接关闭浏览器标签页');
          }
        };
      }
    })();

    return () => {
      cancelled = true;
      exitAppRef.current = null;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        unlistenClose?.();
      } catch {
        /* ignore */
      }
      flush();
    };
  }, []);

  useEffect(() => {
    if (lastPersistError) {
      // formatPersistError 已含完整用户文案，勿再叠「保存失败：」前缀
      toast.error(lastPersistError);
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
      // 仍有单位但工作区异常：加载空工作区，不添加示例员工
      const orgs = await repo.listOrganizations();
      if (orgs.length > 0) {
        const { organization: org, workspace: ws } =
          await repo.ensureOrgAndWorkspace(
            orgs[0]!.name,
            new Date().getFullYear(),
          );
        switchWorkspaceSnapshot({
          organization: org,
          workspace: ws,
          employees: [],
          monthlyRecords: {},
          bonusRecords: {},
          boardLayout: useTaxStore.getState().boardLayout,
        });
        useTaxStore.getState().resetBoardLayout();
        await useTaxStore.getState().persistNow();
        rememberWorkspaceId(ws.id);
        await refreshWorkspaceList(repo);
        toast.message(
          `已切换到 ${org.name}。请在「员工花名册」中新建员工。`,
        );
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
          // 父级在 hydrate 成功后关弹窗（勿依赖子组件 onClose + 渲染期 organization 闭包）
          setOrgManagerOpen(false);
          toast.success(
            `已创建「${snap.organization.name}」· ${snap.workspace.year} 年。请在「员工花名册」中新建员工。`,
          );
          return;
        }
      }
      toast.success('单位已创建。请在「员工花名册」中新建员工。');
      if (useTaxStore.getState().organization) {
        setOrgManagerOpen(false);
      }
    }
  };

  /** 删光单位后：回到无单位引导，不自动重建默认单位 */
  const handleNeedBootstrap = async () => {
    enterEmptyState();
    if (repo) await refreshWorkspaceList(repo);
    setOrgManagerOpen(true);
    toast.message('已删除全部单位。请创建新单位后继续。');
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

  /** 立即保存：刷写 debounce 中的编辑到持久化存储 */
  const handleForceSave = async () => {
    if (!repo) {
      toast.error('数据库未就绪，无法保存');
      return;
    }
    setDataBusy(true);
    try {
      await useTaxStore.getState().flushPersist();
      toast.success('已立即保存到本地数据库');
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? `保存失败：${e.message}` : '保存失败',
      );
    } finally {
      setDataBusy(false);
    }
  };

  /** 导出全量备份：Tauri 下弹出「另存为」自选路径；Web 走下载 */
  const handleExportBackup = async () => {
    if (!repo) {
      toast.error('数据库未就绪，无法导出备份');
      return;
    }
    setDataBusy(true);
    try {
      await useTaxStore.getState().flushPersist();
      const bytes = await exportBackupBytes(repo);
      const defaultName = buildBackupFilename();
      const saved = await saveBackupWithPicker(bytes, defaultName);
      if (!saved) {
        toast.message('已取消导出');
        return;
      }
      toast.success(
        canUseNativeBackupPicker()
          ? `已导出备份到：${saved}`
          : `已导出备份：${saved}`,
      );
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? `导出失败：${e.message}` : '导出备份失败',
      );
    } finally {
      setDataBusy(false);
    }
  };

  /** 从字节恢复并刷新界面 */
  const restoreFromBytes = async (label: string, buf: Uint8Array) => {
    if (!repo) {
      toast.error('数据库未就绪，无法恢复');
      return;
    }
    const ok = window.confirm(
      `确定从备份「${label}」恢复吗？\n\n将覆盖当前全部单位、员工与工资数据，且不可撤销。\n建议先点「导出备份」留一份当前数据。`,
    );
    if (!ok) return;

    setDataBusy(true);
    try {
      await useTaxStore.getState().flushPersist().catch(() => {
        /* 仍尝试恢复 */
      });
      await restoreBackupBytes(repo, buf);

      const list = await repo.listWorkspaces();
      setWorkspaces(list);
      if (list.length === 0) {
        enterEmptyState();
        setOrgManagerOpen(true);
        toast.success('已恢复备份（备份为空）。请创建单位后开始使用。');
        return;
      }
      let targetId = list[0]!.id;
      const last = readLastWorkspaceId();
      if (last && list.some((w) => w.id === last)) targetId = last;
      const snap = await repo.loadWorkspace(targetId);
      if (snap) {
        switchWorkspaceSnapshot(snap);
        rememberWorkspaceId(snap.workspace.id);
      }
      toast.success(
        `已从备份恢复：${list.length} 个工作区。请核对单位与年度。`,
      );
    } catch (e) {
      console.error(e);
      if (e instanceof BackupFormatError) {
        toast.error(`备份无效，未修改当前数据：${e.message}`);
      } else {
        toast.error(
          e instanceof Error ? `恢复失败：${e.message}` : '恢复失败',
        );
      }
    } finally {
      setDataBusy(false);
    }
  };

  /** Web 回退：input[type=file] */
  const handleRestoreBackupFile = async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    await restoreFromBytes(file.name, buf);
  };

  /** 桌面：系统「打开文件」；Web：触发隐藏 file input */
  const handleRestoreBackup = async () => {
    if (!repo) {
      toast.error('数据库未就绪，无法恢复');
      return;
    }
    if (canUseNativeBackupPicker()) {
      try {
        const picked = await pickBackupFileWithPicker();
        if (!picked) {
          toast.message('已取消选择备份文件');
          return;
        }
        await restoreFromBytes(picked.name, picked.bytes);
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? `打开备份失败：${e.message}` : '打开备份失败',
        );
      }
      return;
    }
    backupFileInputRef.current?.click();
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
            </div>
          </div>

          <div className="app-divider hidden sm:block" />

          <span
            className="workspace-chip"
            title={organization ? '当前单位' : '尚未创建单位'}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                organization ? 'bg-[var(--primary)]' : 'bg-[var(--text-faint)]'
              }`}
            />
            <span className="truncate max-w-[8rem] sm:max-w-[12rem]">
              {organization?.name ?? '未创建单位'}
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
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".dude-tax-backup,.json,application/json"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleRestoreBackupFile(f);
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              disabled={dataBusy || !repo}
              title="将当前未落盘的编辑立即写入本地数据库，降低关窗/断电丢数风险"
              onClick={() => {
                void handleForceSave();
              }}
            >
              <Save size={14} />
              立即保存
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              disabled={dataBusy || !repo}
              title="导出全部单位与工作区数据；可自选保存路径与文件名"
              onClick={() => {
                void handleExportBackup();
              }}
            >
              <Download size={14} />
              导出备份
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              tabIndex={navCollapsed ? -1 : 0}
              disabled={dataBusy || !repo}
              title="自选备份文件恢复；将覆盖当前全部数据，请先导出备份"
              onClick={() => {
                void handleRestoreBackup();
              }}
            >
              <Upload size={14} />
              从备份恢复
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
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
              <HardDriveDownload size={14} />
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

          <button
            type="button"
            className="btn btn-secondary btn-sm nav-exit-btn"
            tabIndex={navCollapsed ? -1 : 0}
            disabled={exiting}
            title="保存当前修改并退出程序"
            onClick={() => {
              if (exiting) return;
              setExiting(true);
              const run = exitAppRef.current;
              if (run) {
                void run().finally(() => {
                  // 若未真正退出（极少见），允许再点
                  window.setTimeout(() => setExiting(false), 4_000);
                });
              } else {
                void (async () => {
                  try {
                    await useTaxStore.getState().flushPersist();
                  } catch {
                    /* ignore */
                  }
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('force_quit');
                  } catch {
                    toast.error('退出失败，请尝试关闭窗口或结束进程');
                    setExiting(false);
                  }
                })();
              }
            }}
          >
            <LogOut size={14} />
            {exiting ? '正在退出…' : '退出'}
          </button>
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

      <main className="min-h-0 flex-1 relative">
        {organization ? (
          <TaxCanvas />
        ) : (
          <div className="empty-org-guide">
            <div className="empty-org-guide-card">
              <div className="empty-org-guide-icon" aria-hidden>
                <Building2 size={28} strokeWidth={1.75} />
              </div>
              <h2 className="empty-org-guide-title">开始使用 Dude Tax</h2>
              <p className="empty-org-guide-text">
                当前没有任何单位。请先创建核算单位，再在「员工花名册」中新建员工并录入工资。
                不会自动生成默认单位或示例员工。
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setOrgManagerOpen(true)}
              >
                <Building2 size={15} />
                创建单位
              </button>
            </div>
          </div>
        )}
      </main>

      <ConfirmModal />
      <OrgManagerModal
        open={orgManagerOpen}
        onClose={() => {
          // 读 store 当前值，避免 await 后仍闭包到 render 时 organization=null
          if (!useTaxStore.getState().organization) {
            setOrgManagerOpen(true);
            return;
          }
          setOrgManagerOpen(false);
        }}
        repo={repo}
        currentOrgId={organization?.id ?? null}
        defaultYear={workspace?.year ?? new Date().getFullYear()}
        requireCreate={!organization}
        onOrgsChanged={async (opts) => {
          await handleOrgsChanged(opts);
        }}
        onNeedBootstrap={() => {
          void handleNeedBootstrap();
        }}
      />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
