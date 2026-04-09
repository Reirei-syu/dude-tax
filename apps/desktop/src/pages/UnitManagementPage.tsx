import type { DeleteUnitChallenge } from "@dude-tax/core";
import { useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

export const UnitManagementPage = () => {
  const { context, refresh, updateContext } = useAppContext();
  const selectedUnit = useMemo(
    () => context?.units.find((item) => item.id === context.currentUnitId) ?? null,
    [context],
  );

  const [unitName, setUnitName] = useState("");
  const [remark, setRemark] = useState("");
  const [startYear, setStartYear] = useState(context?.currentTaxYear ?? new Date().getFullYear());
  const [newYear, setNewYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteChallenge, setDeleteChallenge] = useState<DeleteUnitChallenge | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<number | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [finalDeleteConfirm, setFinalDeleteConfirm] = useState(false);

  const createUnit = async () => {
    if (!unitName.trim()) {
      setErrorMessage("单位名称不能为空");
      return;
    }

    if (!Number.isInteger(startYear) || startYear < 1900) {
      setErrorMessage("起始年份必须为大于等于 1900 的整数");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const createdUnit = await apiClient.createUnit({
        unitName,
        remark,
        startYear,
      });

      await refresh();
      await updateContext({
        currentUnitId: createdUnit.id,
        currentTaxYear: startYear,
      });

      setUnitName("");
      setRemark("");
      setSuccessMessage(`已创建单位“${createdUnit.unitName}”，当前年份已切换到 ${startYear}。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增单位失败");
    } finally {
      setSubmitting(false);
    }
  };

  const addYear = async () => {
    if (!selectedUnit) {
      setErrorMessage("请先选择一个单位");
      return;
    }

    const nextYear = Number(newYear);
    if (!Number.isInteger(nextYear) || nextYear < 1900) {
      setErrorMessage("新增年份必须为大于等于 1900 的整数");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await apiClient.addUnitYear(selectedUnit.id, nextYear);
      await refresh();
      setNewYear("");
      setSuccessMessage(`已为“${selectedUnit.unitName}”新增 ${nextYear} 年。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增年份失败");
    } finally {
      setSubmitting(false);
    }
  };

  const removeYear = async (taxYear: number) => {
    if (!selectedUnit) {
      return;
    }

    const confirmed = window.confirm(`确认删除“${selectedUnit.unitName}”的 ${taxYear} 年吗？`);
    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const updatedUnit = await apiClient.deleteUnitYear(selectedUnit.id, taxYear);
      await refresh();
      if (context?.currentUnitId === selectedUnit.id && !updatedUnit.availableTaxYears.includes(context.currentTaxYear)) {
        await updateContext({
          currentTaxYear: updatedUnit.availableTaxYears[0] ?? context.currentTaxYear,
        });
      }
      setSuccessMessage(`已删除 ${taxYear} 年。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除年份失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteChallenge = async (targetUnitId: number) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      const challenge = await apiClient.createDeleteChallenge(targetUnitId);
      setDeleteChallenge(challenge);
      setDeleteUnitId(targetUnitId);
      setDeleteInput("");
      setFinalDeleteConfirm(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成删除认证失败");
    }
  };

  const executeDelete = async () => {
    if (!deleteChallenge || deleteUnitId === null) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await apiClient.deleteUnit(deleteUnitId, deleteChallenge.challengeId, deleteInput.trim());
      setDeleteChallenge(null);
      setDeleteUnitId(null);
      setDeleteInput("");
      setFinalDeleteConfirm(false);
      await refresh();
      setSuccessMessage("单位已删除。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除单位失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>单位管理</h1>
            <p>新增单位时只建立起始年份，后续年份由你按需手动管理。</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>单位名称</span>
            <input
              placeholder="请输入单位名称"
              value={unitName}
              onChange={(event) => setUnitName(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>备注</span>
            <input
              placeholder="可选备注"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>起始年份</span>
            <input
              min={1900}
              step={1}
              type="number"
              value={startYear}
              onChange={(event) => setStartYear(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" disabled={submitting} onClick={() => void createUnit()}>
            新增单位
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>单位列表</h2>
            <p>点击“进入工作”即可切换当前单位。</p>
          </div>
        </div>

        <div className="unit-list">
          {context?.units.length ? (
            context.units.map((unit) => (
              <div className="unit-item" key={unit.id}>
                <div>
                  <strong>{unit.unitName}</strong>
                  <p>{unit.remark || "暂无备注"}</p>
                  <p>年份：{unit.availableTaxYears.join("、")}</p>
                </div>

                <div className="button-row compact">
                  <button
                    className="ghost-button"
                    onClick={() =>
                      void updateContext({
                        currentUnitId: unit.id,
                        currentTaxYear:
                          unit.availableTaxYears.includes(context?.currentTaxYear ?? -1)
                            ? (context?.currentTaxYear ?? unit.availableTaxYears[0] ?? startYear)
                            : (unit.availableTaxYears[0] ?? startYear),
                      })
                    }
                  >
                    {selectedUnit?.id === unit.id ? "当前单位" : "进入工作"}
                  </button>
                  <button className="danger-button" onClick={() => void openDeleteChallenge(unit.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">当前还没有单位，请先创建单位。</div>
          )}
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>年份管理</h2>
            <p>只显示当前单位已有年份；可新增历史年份，也可新增未来年份。</p>
          </div>
          <span className="tag">{selectedUnit?.unitName ?? "未选择单位"}</span>
        </div>

        {selectedUnit ? (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>新增年份</span>
                <input
                  min={1900}
                  placeholder="例如 2035"
                  step={1}
                  type="number"
                  value={newYear}
                  onChange={(event) => setNewYear(event.target.value)}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="ghost-button" disabled={submitting} onClick={() => void addYear()}>
                新增年份
              </button>
            </div>

            <div className="year-chip-list">
              {selectedUnit.availableTaxYears.map((year) => (
                <div className="year-chip-card" key={year}>
                  <button
                    className={
                      context?.currentTaxYear === year ? "ghost-button selected-item" : "ghost-button"
                    }
                    onClick={() => void updateContext({ currentTaxYear: year })}
                    type="button"
                  >
                    {year} 年
                  </button>
                  <button
                    className="danger-button"
                    disabled={submitting}
                    onClick={() => void removeYear(year)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">请先在左侧切换到目标单位，再管理年份。</div>
        )}
      </article>

      {deleteChallenge && deleteUnitId !== null ? (
        <article className="glass-card page-section">
          <div className="section-header">
            <div>
              <h2>删除单位认证</h2>
              <p>删除后不可恢复。若需保留历史数据，请先备份。</p>
            </div>
          </div>

          <div className="delete-challenge-box">
            <div className="challenge-code">{deleteChallenge.confirmationCode}</div>
            <p>请输入上方 6 位认证字符，然后勾选不可恢复确认。</p>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span>认证字符</span>
              <input value={deleteInput} onChange={(event) => setDeleteInput(event.target.value)} />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              checked={finalDeleteConfirm}
              onChange={(event) => setFinalDeleteConfirm(event.target.checked)}
              type="checkbox"
            />
            <span>我已知晓该操作不可恢复，并确认继续删除。</span>
          </label>

          <div className="button-row">
            <button
              className="danger-button"
              disabled={
                submitting ||
                deleteInput !== deleteChallenge.confirmationCode ||
                !finalDeleteConfirm
              }
              onClick={() => void executeDelete()}
            >
              确认删除
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
};
