import {
  buildDefaultTaxPolicySettings,
  type EmployeeCalculationStatus,
  type TaxPolicyResponse,
} from "@dude-tax/core";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import { buildHomeSuggestions } from "./home-suggestions";

export const HomePage = () => {
  const { context, errorMessage, loading } = useAppContext();
  const currentUnit = context?.units.find((item) => item.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const [statuses, setStatuses] = useState<EmployeeCalculationStatus[]>([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderErrorMessage, setReminderErrorMessage] = useState<string | null>(null);
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [taxPolicyLoading, setTaxPolicyLoading] = useState(false);
  const [taxPolicyErrorMessage, setTaxPolicyErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadTaxPolicy = async () => {
      try {
        setTaxPolicyLoading(true);
        setTaxPolicyErrorMessage(null);
        const nextTaxPolicy = await apiClient.getTaxPolicy();
        setTaxPolicy(nextTaxPolicy);
      } catch (error) {
        setTaxPolicyErrorMessage(error instanceof Error ? error.message : "加载税率失败");
      } finally {
        setTaxPolicyLoading(false);
      }
    };

    void loadTaxPolicy();
  }, []);

  useEffect(() => {
    const loadReminderStatuses = async () => {
      if (!currentUnitId || !currentTaxYear) {
        setStatuses([]);
        setReminderErrorMessage(null);
        return;
      }

      try {
        setReminderLoading(true);
        setReminderErrorMessage(null);
        const nextStatuses = await apiClient.listCalculationStatuses(currentUnitId, currentTaxYear);
        setStatuses(nextStatuses);
      } catch (error) {
        setReminderErrorMessage(error instanceof Error ? error.message : "加载工作提醒失败");
      } finally {
        setReminderLoading(false);
      }
    };

    void loadReminderStatuses();
  }, [currentTaxYear, currentUnitId]);

  const employeeCount = statuses.length;

  const reminderItems = useMemo(
    () => [
      {
        title: "待结果确认",
        description: "点击前往结果确认查看尚未确认或需重新确认的员工结果。",
        path: "/result-confirmation",
        count: statuses.filter(
          (status) =>
            status.preparationStatus === "ready" &&
            (!status.lastCalculatedAt || status.isInvalidated),
        ).length,
      },
      {
        title: "未完成月份",
        description: "点击前往月度数据录入，继续补齐当前单位年度数据。",
        path: "/entry",
        count: statuses.reduce(
          (sum, status) => sum + Math.max(12 - status.completedMonthCount, 0),
          0,
        ),
      },
      {
        title: "员工档案待维护",
        description: "点击前往员工信息维护基础档案，或使用新的页内导入入口。", 
        path: "/employees",
        count: employeeCount === 0 ? 1 : 0,
      },
    ],
    [employeeCount, statuses],
  );

  const pendingRecalculateCount = reminderItems[0]?.count ?? 0;
  const incompleteMonthCount = reminderItems[1]?.count ?? 0;
  const currentTaxPolicy = taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();

  const workSuggestions = useMemo(
    () =>
      buildHomeSuggestions({
        currentUnitId,
        currentTaxYear,
        employeeCount,
        incompleteMonthCount,
        pendingRecalculateCount,
        invalidatedCount: statuses.filter((status) => status.isInvalidated).length,
        statuses,
      }),
    [
      currentTaxYear,
      currentUnitId,
      employeeCount,
      incompleteMonthCount,
      pendingRecalculateCount,
      statuses,
    ],
  );

  return (
    <section className="page-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>首页</h1>
            <p>这里是当前单位和年份的工作总控台。</p>
          </div>
          <span className="tag">
            {loading || reminderLoading || taxPolicyLoading ? "加载中" : "工作提醒已联动"}
          </span>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>当前单位</span>
            <strong>{currentUnit?.unitName ?? "未选择单位"}</strong>
          </div>
          <div className="summary-card">
            <span>当前年份</span>
            <strong>{context?.currentTaxYear ?? "-"}</strong>
          </div>
          <div className="summary-card">
            <span>全局税率</span>
            <strong>{taxPolicy?.isCustomized ? "已自定义" : "默认版本"}</strong>
          </div>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {reminderErrorMessage ? <div className="error-banner">{reminderErrorMessage}</div> : null}
        {taxPolicyErrorMessage ? <div className="error-banner">{taxPolicyErrorMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>工作提醒</h2>
            <p>点击条目即可跳转到待处理模块。</p>
          </div>
        </div>

        <div className="reminder-list">
          {reminderItems.map((item) => (
            <Link className="reminder-item" key={item.title} to={item.path}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <span>{item.count}</span>
            </Link>
          ))}
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>工作建议</h2>
            <p>根据当前单位、年份和准备状态，给出下一步建议入口。</p>
          </div>
        </div>

        <div className="work-suggestion-grid">
          {workSuggestions.map((suggestion) => (
            <Link className="work-suggestion-card" key={suggestion.title} to={suggestion.path}>
              <div>
                <strong>{suggestion.title}</strong>
                <p>{suggestion.description}</p>
              </div>
              <span>{suggestion.actionLabel}</span>
            </Link>
          ))}
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>当前税率表</h2>
            <p>首页税率表读取当前生效税率，和后续计算保持同源。</p>
          </div>
        </div>

        <div className="tax-rule-block">
          <div className="tax-rule-title">减除费用</div>
          <div className="tax-rule-value">
            {currentTaxPolicy.basicDeductionAmount.toLocaleString()} 元 / 月
          </div>
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
                {currentTaxPolicy.comprehensiveTaxBrackets.map((bracket) => (
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
                {currentTaxPolicy.bonusTaxBrackets.map((bracket) => (
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
    </section>
  );
};
