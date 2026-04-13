import { MODULE_NAV_ITEMS } from "@dude-tax/config";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import { normalizeNavigationOrder } from "../layout/workspace-layout";
import { canMoveNavItem, moveNavItemByStep } from "./navigation-order";

export const AppLayout = () => {
  const { context, loading, updateContext } = useAppContext();
  const [uiSidebarCollapsed, setUiSidebarCollapsed] = useState(false);
  const [navigationOrder, setNavigationOrder] = useState<string[]>(
    MODULE_NAV_ITEMS.map((item) => item.path),
  );
  const [isNavSortMode, setIsNavSortMode] = useState(false);
  const currentUnit = context?.units.find((unit) => unit.id === context.currentUnitId) ?? null;
  const availableTaxYears = currentUnit?.availableTaxYears ?? [];
  const navigationItems = useMemo(() => {
    const itemMap = new Map(MODULE_NAV_ITEMS.map((item) => [item.path, item] as const));
    return normalizeNavigationOrder(navigationOrder)
      .map((path) => itemMap.get(path))
      .filter((item) => item !== undefined);
  }, [navigationOrder]);

  useEffect(() => {
    const loadSidebarPreference = async () => {
      try {
        const [sidebarPreference, navigationOrderPreference] = await Promise.all([
          apiClient.getSidebarPreference(),
          apiClient.getNavigationOrderPreference(),
        ]);
        setUiSidebarCollapsed(sidebarPreference.collapsed);
        setNavigationOrder(navigationOrderPreference.order);
      } catch {
        setUiSidebarCollapsed(false);
        setNavigationOrder(MODULE_NAV_ITEMS.map((item) => item.path));
      }
    };

    void loadSidebarPreference();
  }, []);

  const commitNavigationOrder = (nextOrder: string[]) => {
    const normalizedOrder = normalizeNavigationOrder(nextOrder);
    setNavigationOrder(normalizedOrder);
    void apiClient.updateNavigationOrderPreference(normalizedOrder);
  };

  return (
    <div
      className={[
        "app-shell",
        uiSidebarCollapsed ? "is-sidebar-collapsed" : "",
        isNavSortMode ? "is-nav-sort-mode" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <aside className={uiSidebarCollapsed ? "sidebar is-collapsed" : "sidebar"}>
        <div className="sidebar-brand-row">
          <button
            aria-label={uiSidebarCollapsed ? "展开导航" : "收起导航"}
            className="sidebar-toggle"
            type="button"
            disabled={isNavSortMode}
            onClick={() => {
              const nextCollapsed = !uiSidebarCollapsed;
              setUiSidebarCollapsed(nextCollapsed);
              void apiClient.updateSidebarPreference(nextCollapsed);
            }}
          >
            {uiSidebarCollapsed ? "›" : "‹"}
          </button>
          <div className="brand-card">
            <div className="brand-title">工资薪金个税计算器</div>
            <div className="brand-subtitle">0.1.0</div>
          </div>
        </div>

        <nav className="nav-list">
          {navigationItems.map((item) => (
            <div
              className={isNavSortMode ? "nav-item-shell is-sort-mode" : "nav-item-shell"}
              key={item.path}
            >
              <NavLink
                className={({ isActive }) =>
                  [
                    "nav-item",
                    isActive ? "active" : "",
                    isNavSortMode ? "is-sort-mode is-sort-mode-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                aria-disabled={isNavSortMode || undefined}
                onClick={(clickEvent) => {
                  if (isNavSortMode) {
                    clickEvent.preventDefault();
                  }
                }}
                tabIndex={isNavSortMode ? -1 : undefined}
                to={item.path}
              >
                <span className="nav-item-content">
                  <span>{item.label}</span>
                  {item.isPlaceholder ? <small>规划中</small> : null}
                </span>
              </NavLink>
              {isNavSortMode ? (
                <div className="nav-item-sort-controls">
                  <button
                    aria-label={`上移${item.label}`}
                    className="nav-sort-arrow-button"
                    disabled={!canMoveNavItem(navigationOrder, item.path, -1)}
                    type="button"
                    onClick={() =>
                      commitNavigationOrder(moveNavItemByStep(navigationOrder, item.path, -1))
                    }
                  >
                    ▲
                  </button>
                  <button
                    aria-label={`下移${item.label}`}
                    className="nav-sort-arrow-button"
                    disabled={!canMoveNavItem(navigationOrder, item.path, 1)}
                    type="button"
                    onClick={() =>
                      commitNavigationOrder(moveNavItemByStep(navigationOrder, item.path, 1))
                    }
                  >
                    ▼
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button
            className={isNavSortMode ? "ghost-button sort-mode-button is-active" : "ghost-button sort-mode-button"}
            type="button"
            aria-label={isNavSortMode ? "完成导航排序" : "启用导航排序"}
            aria-pressed={isNavSortMode}
            title={isNavSortMode ? "完成导航排序" : "启用导航排序"}
            onClick={() => {
              setIsNavSortMode((currentValue) => !currentValue);
              document.body.classList.remove("workspace-interacting");
            }}
          >
            {isNavSortMode ? "完成导航排序" : "启用导航排序↑↓"}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="context-bar glass-card">
          <div className="context-group">
            <label className="field-label" htmlFor="unit-select">
              当前单位
            </label>
            <select
              id="unit-select"
              disabled={loading || !context?.units.length}
              value={context?.currentUnitId ?? ""}
              onChange={(event) => {
                const nextUnitId = event.target.value ? Number(event.target.value) : null;
                void updateContext({ currentUnitId: nextUnitId });
              }}
            >
              {!context?.units.length ? <option value="">请先创建单位</option> : null}
              {context?.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitName}
                </option>
              ))}
            </select>
          </div>

          <div className="context-group">
            <label className="field-label" htmlFor="tax-year-select">
              当前年份
            </label>
            <select
              id="tax-year-select"
              disabled={loading || !availableTaxYears.length}
              value={context?.currentTaxYear ?? availableTaxYears[0] ?? ""}
              onChange={(event) => {
                void updateContext({ currentTaxYear: Number(event.target.value) });
              }}
            >
              {!availableTaxYears.length ? <option value="">请先在单位管理中新增年份</option> : null}
              {availableTaxYears.map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
            </select>
          </div>

          <div className="context-summary">
            <div>请先确定单位和年份，再进入具体业务模块。</div>
            <strong>
              {currentUnit?.unitName ?? "未选择单位"} / {context?.currentTaxYear ?? "-"} 年
            </strong>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
};
