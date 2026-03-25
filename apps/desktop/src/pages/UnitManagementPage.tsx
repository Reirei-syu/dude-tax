import type { DeleteUnitChallenge } from "../../../../packages/core/src/index";
import { useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

export const UnitManagementPage = () => {
  const { context, refresh, updateContext } = useAppContext();
  const [unitName, setUnitName] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteChallenge, setDeleteChallenge] = useState<DeleteUnitChallenge | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<number | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [finalDeleteConfirm, setFinalDeleteConfirm] = useState(false);

  const selectedUnit = useMemo(
    () => context?.units.find((item) => item.id === context.currentUnitId) ?? null,
    [context],
  );

  const createUnit = async () => {
    if (!unitName.trim()) {
      setErrorMessage("单位名称不能为空");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const createdUnit = await apiClient.createUnit({ unitName, remark });
      await refresh();
      await updateContext({ currentUnitId: createdUnit.id });
      setUnitName("");
      setRemark("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增单位失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteChallenge = async (targetUnitId: number) => {
    try {
      setErrorMessage(null);
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
      await apiClient.deleteUnit(deleteUnitId, deleteChallenge.challengeId, deleteInput.trim());
      setDeleteChallenge(null);
      setDeleteUnitId(null);
      setDeleteInput("");
      setFinalDeleteConfirm(false);
      await refresh();
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
            <p>先维护单位，再进入当前单位/年份房间进行后续工作。</p>
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
        </div>

        <div className="button-row">
          <button className="primary-button" disabled={submitting} onClick={() => void createUnit()}>
            新增单位
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>单位列表</h2>
            <p>点击“进入工作”即可将其设为当前单位。</p>
          </div>
        </div>

        <div className="unit-list">
          {context?.units.length ? (
            context.units.map((unit) => (
              <div className="unit-item" key={unit.id}>
                <div>
                  <strong>{unit.unitName}</strong>
                  <p>{unit.remark || "暂无备注"}</p>
                </div>

                <div className="button-row compact">
                  <button
                    className="ghost-button"
                    onClick={() => void updateContext({ currentUnitId: unit.id })}
                  >
                    {selectedUnit?.id === unit.id ? "当前单位" : "进入工作"}
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => void openDeleteChallenge(unit.id)}
                  >
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

      {deleteChallenge && deleteUnitId !== null ? (
        <article className="glass-card page-section">
          <div className="section-header">
            <div>
              <h2>删除单位认证</h2>
              <p>删除后不可恢复。若需保留历史数据，请先执行整库备份。</p>
            </div>
          </div>

          <div className="delete-challenge-box">
            <div className="challenge-code">{deleteChallenge.confirmationCode}</div>
            <p>请输入上方 6 位随机认证字符，然后勾选不可恢复确认。</p>
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
