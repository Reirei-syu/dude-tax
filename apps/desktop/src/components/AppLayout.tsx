import { MODULE_NAV_ITEMS, getSelectableYears } from "@salary-tax/config";
import { NavLink, Outlet } from "react-router-dom";
import { useAppContext } from "../context/AppContextProvider";

export const AppLayout = () => {
  const { context, loading, updateContext } = useAppContext();
  const years = getSelectableYears();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-title">工资薪金个税计算器</div>
          <div className="brand-subtitle">v0.1.0-alpha</div>
        </div>

        <nav className="nav-list">
          {MODULE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
              to={item.path}
            >
              <span>{item.label}</span>
              {item.isPlaceholder ? <small>规划中</small> : null}
            </NavLink>
          ))}
        </nav>
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
                const nextValue = event.target.value ? Number(event.target.value) : null;
                void updateContext({ currentUnitId: nextValue });
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
              disabled={loading}
              value={context?.currentTaxYear ?? years[0]}
              onChange={(event) => {
                void updateContext({ currentTaxYear: Number(event.target.value) });
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year} 年度
                </option>
              ))}
            </select>
          </div>

          <div className="context-summary">
            <div>先选单位和年份，再进入后续工作模块。</div>
            <strong>
              {context?.units.find((item) => item.id === context.currentUnitId)?.unitName ?? "未选择单位"} /{" "}
              {context?.currentTaxYear ?? "-"} 年
            </strong>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
};

