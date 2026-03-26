import {
  BONUS_TAX_BRACKETS,
  COMPREHENSIVE_TAX_BRACKETS,
  DEFAULT_BASIC_DEDUCTION_AMOUNT,
} from "../../../../packages/config/src/index";
import { useAppContext } from "../context/AppContextProvider";

const maintenanceScopeItems = [
  "当前版本仅开放税标与维护范围查看，还不支持在线编辑和持久化保存。",
  "后续税标变更将统一作用于首页、计算中心和快速计算模块。",
  "税标持久化、版本管理和结果失效策略将在后续里程碑中补齐。",
];

const maintenanceRoadmapItems = [
  "税标维护：基本减除费用、综合所得税率表、年终奖单独计税税率表。",
  "说明维护：全局提示说明与口径备注。",
  "结果联动：税标变更后的结果失效与重算提醒。",
];

export const MaintenancePage = () => {
  const { context } = useAppContext();
  const currentUnit = context?.units.find((unit) => unit.id === context.currentUnitId) ?? null;

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>系统维护</h1>
            <p>当前先提供全局税标与维护边界的只读视图，为后续可编辑版本做准备。</p>
          </div>
          <span className="tag">只读预览版</span>
        </div>

        <div className="summary-grid results-summary-grid">
          <div className="summary-card">
            <span>当前单位</span>
            <strong>{currentUnit?.unitName ?? "未选择单位"}</strong>
          </div>
          <div className="summary-card">
            <span>当前年份</span>
            <strong>{context?.currentTaxYear ?? "-"}</strong>
          </div>
          <div className="summary-card">
            <span>当前税标版本</span>
            <strong>默认静态版本</strong>
          </div>
          <div className="summary-card">
            <span>编辑状态</span>
            <strong>未开放</strong>
          </div>
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>维护范围</h2>
            <p>用于明确当前模块已开放与未开放的边界，避免误操作预期。</p>
          </div>
        </div>

        <div className="reminder-list">
          {maintenanceScopeItems.map((item) => (
            <div className="maintenance-note-card" key={item}>
              <strong>当前说明</strong>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>默认税标</h2>
            <p>当前计算逻辑和首页展示均使用下面这一套静态默认税标。</p>
          </div>
        </div>

        <div className="tax-rule-block">
          <div className="tax-rule-title">基本减除费用</div>
          <div className="tax-rule-value">{DEFAULT_BASIC_DEDUCTION_AMOUNT.toLocaleString()} 元 / 月</div>
        </div>

        <div className="tax-rule-columns">
          <div>
            <h3>综合所得税率表</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>级数</th>
                  <th>应纳税所得额</th>
                  <th>税率</th>
                  <th>速算扣除数</th>
                </tr>
              </thead>
              <tbody>
                {COMPREHENSIVE_TAX_BRACKETS.map((bracket) => (
                  <tr key={bracket.level}>
                    <td>{bracket.level}</td>
                    <td>{bracket.rangeText}</td>
                    <td>{bracket.rate}%</td>
                    <td>{bracket.quickDeduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3>年终奖单独计税税率表</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>级数</th>
                  <th>平均每月额</th>
                  <th>税率</th>
                  <th>速算扣除数</th>
                </tr>
              </thead>
              <tbody>
                {BONUS_TAX_BRACKETS.map((bracket) => (
                  <tr key={bracket.level}>
                    <td>{bracket.level}</td>
                    <td>{bracket.rangeText}</td>
                    <td>{bracket.rate}%</td>
                    <td>{bracket.quickDeduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>后续开放内容</h2>
            <p>这一部分用于标记下一步开发目标，方便后续从只读版平滑过渡到可编辑版。</p>
          </div>
        </div>

        <div className="reminder-list">
          {maintenanceRoadmapItems.map((item) => (
            <div className="maintenance-note-card" key={item}>
              <strong>待开发</strong>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
};
