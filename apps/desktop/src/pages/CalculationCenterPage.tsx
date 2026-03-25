import type { EmployeeCalculationStatus } from "../../../../packages/core/src/index";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

const statusLabelMap: Record<EmployeeCalculationStatus["preparationStatus"], string> = {
  not_started: "未开始",
  draft: "待补录",
  ready: "可计算",
};

export const CalculationCenterPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [statuses, setStatuses] = useState<EmployeeCalculationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<number | "all" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    return {
      total: statuses.length,
      notStarted: statuses.filter((status) => status.preparationStatus === "not_started").length,
      draft: statuses.filter((status) => status.preparationStatus === "draft").length,
      ready: statuses.filter((status) => status.preparationStatus === "ready").length,
    };
  }, [statuses]);
  const hasReadyEmployees = summary.ready > 0;

  const loadStatuses = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setStatuses([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const nextStatuses = await apiClient.listCalculationStatuses(currentUnitId, currentTaxYear);
      setStatuses(nextStatuses);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载计算状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatuses();
  }, [currentUnitId, currentTaxYear]);

  const triggerRecalculate = async (employeeId?: number) => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    try {
      setSubmitting(employeeId ?? "all");
      setErrorMessage(null);
      const nextStatuses = await apiClient.recalculateStatuses(currentUnitId, currentTaxYear, employeeId);
      setStatuses(nextStatuses);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行重算失败");
    } finally {
      setSubmitting(null);
    }
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>计算中心</h1>
          <p>请先在顶部选择单位和年份，再进入计算中心。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>计算中心</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">已接入年度重算入口</span>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>员工总数</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="summary-card">
            <span>待补录</span>
            <strong>{summary.draft}</strong>
          </div>
          <div className="summary-card">
            <span>可计算</span>
            <strong>{summary.ready}</strong>
          </div>
        </div>

        <div className="button-row">
          <button className="ghost-button" disabled={loading} onClick={() => void loadStatuses()}>
            刷新状态
          </button>
          <button
            className="primary-button"
            disabled={!hasReadyEmployees || submitting === "all"}
            onClick={() => void triggerRecalculate()}
          >
            重算全部
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>员工计算准备状态</h2>
            <p>只有“可计算”员工可执行重算；重算成功后请到结果中心查看年度结果。</p>
          </div>
          <span className="tag">{loading ? "加载中" : "已同步"}</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>员工</th>
              <th>已录入月份</th>
              <th>已完成月份</th>
              <th>准备状态</th>
              <th>最近重算时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {statuses.length ? (
              statuses.map((status) => (
                <tr key={status.employeeId}>
                  <td>
                    {status.employeeName}
                    <br />
                    <small>{status.employeeCode}</small>
                  </td>
                  <td>{status.recordedMonthCount}</td>
                  <td>{status.completedMonthCount}</td>
                  <td>{statusLabelMap[status.preparationStatus]}</td>
                  <td>{status.lastCalculatedAt ?? "-"}</td>
                  <td>
                    <button
                      className="ghost-button"
                      disabled={
                        submitting === status.employeeId || status.preparationStatus !== "ready"
                      }
                      onClick={() => void triggerRecalculate(status.employeeId)}
                    >
                      重算
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>当前单位下暂无员工，或尚未建立员工数据。</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
};
