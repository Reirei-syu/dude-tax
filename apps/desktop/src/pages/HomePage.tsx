import {
  BONUS_TAX_BRACKETS,
  COMPREHENSIVE_TAX_BRACKETS,
  DEFAULT_BASIC_DEDUCTION_AMOUNT,
} from "../../../../packages/config/src/index";
import type { EmployeeCalculationStatus } from "../../../../packages/core/src/index";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

export const HomePage = () => {
  const { context, errorMessage, loading } = useAppContext();
  const currentUnit = context?.units.find((item) => item.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const [statuses, setStatuses] = useState<EmployeeCalculationStatus[]>([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderErrorMessage, setReminderErrorMessage] = useState<string | null>(null);

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

  const reminderItems = useMemo(
    () => [
      {
        title: "待重算",
        description: "点击前往计算中心查看尚未重算的已完备员工。",
        path: "/calculation",
        count: statuses.filter(
          (status) => status.preparationStatus === "ready" && !status.lastCalculatedAt,
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
        title: "导入冲突待处理",
        description: "点击前往批量导入查看冲突预览。",
        path: "/import",
        count: 0,
      },
    ],
    [statuses],
  );

  return (
    <section className="page-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>首页</h1>
            <p>这是当前单位和年份的工作总控台。</p>
          </div>
          <span className="tag">{loading || reminderLoading ? "加载中" : "工作提醒已联动"}</span>
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
            <span>全局税标</span>
            <strong>{context?.currentTaxYear ?? "-"} 年默认版本</strong>
          </div>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {reminderErrorMessage ? <div className="error-banner">{reminderErrorMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>工作提醒</h2>
            <p>点击条目即可跳转到待编辑的目标模块。</p>
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
            <h2>当前税率表</h2>
            <p>首页税率表与后续计算核心保持同源。</p>
          </div>
        </div>

        <div className="tax-rule-block">
          <div className="tax-rule-title">减除费用</div>
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
            <h2>快速计算</h2>
            <p>本模块在当前里程碑暂不开放，只保留入口说明。</p>
          </div>
        </div>
        <div className="quick-calc-card">
          <p>后续将提供不落库的即时录入与速算结果页面，使用当前全局税标。</p>
          <span className="tag">规划中</span>
        </div>
      </article>
    </section>
  );
};
