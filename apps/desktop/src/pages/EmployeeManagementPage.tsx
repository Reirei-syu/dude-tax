import type { CreateEmployeePayload, Employee } from "@dude-tax/core";
import { deriveEmployeeGeneralStatus } from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { ImportWorkflowSection } from "../components/ImportWorkflowSection";
import { useAppContext } from "../context/AppContextProvider";
import { downloadEmployeeImportTemplateWorkbook } from "./import-template";

const emptyForm: CreateEmployeePayload = {
  employeeCode: "",
  employeeName: "",
  idNumber: "",
  hireDate: "",
  leaveDate: "",
  remark: "",
};

const generalStatusLabelMap = {
  active: "在职",
  left: "离职",
} as const;

export const EmployeeManagementPage = () => {
  const { context } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateEmployeePayload>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUnitId = context?.currentUnitId ?? null;
  const currentUnit = useMemo(
    () => context?.units.find((unit) => unit.id === currentUnitId) ?? null,
    [context, currentUnitId],
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const resetForm = () => {
    setSelectedEmployeeId(null);
    setForm(emptyForm);
  };

  const loadEmployees = async () => {
    if (!currentUnitId) {
      setEmployees([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const nextEmployees = await apiClient.listEmployees(currentUnitId);
      setEmployees(nextEmployees);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载员工列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    void loadEmployees();
  }, [currentUnitId]);

  const upsertEmployee = async () => {
    if (!currentUnitId) {
      setErrorMessage("请先选择单位");
      return;
    }

    if (!form.employeeCode.trim() || !form.employeeName.trim() || !form.idNumber.trim()) {
      setErrorMessage("工号、姓名、证件号不能为空");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      if (selectedEmployeeId) {
        await apiClient.updateEmployee(selectedEmployeeId, form);
      } else {
        await apiClient.createEmployee(currentUnitId, form);
      }

      await loadEmployees();
      resetForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存员工失败");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (employee: Employee) => {
    setSelectedEmployeeId(employee.id);
    setForm({
      employeeCode: employee.employeeCode,
      employeeName: employee.employeeName,
      idNumber: employee.idNumber,
      hireDate: employee.hireDate ?? "",
      leaveDate: employee.leaveDate ?? "",
      remark: employee.remark,
    });
  };

  const removeEmployee = async (employeeId: number) => {
    const confirmed = window.confirm("删除员工后不可恢复，是否继续？");
    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await apiClient.deleteEmployee(employeeId);
      await loadEmployees();
      if (selectedEmployeeId === employeeId) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除员工失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUnitId) {
    return (
      <section className="page-grid">
        <CollapsibleSectionCard
          className="placeholder-card"
          description="请先在顶部选择单位，再进入员工信息模块。"
          headingTag="h1"
          title="员工信息"
        />
      </section>
    );
  }

  return (
    <section className="page-grid">
      <CollapsibleSectionCard
        description={`当前仅维护 ${currentUnit?.unitName ?? "当前单位"} 下的员工基础档案。`}
        headingTag="h1"
        headerExtras={<span className="tag">{selectedEmployee ? "编辑员工" : "新增员工"}</span>}
        title="员工信息"
      >
        <div className="form-grid">
          <label className="form-field">
            <span>工号</span>
            <input
              placeholder="请输入工号"
              value={form.employeeCode}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, employeeCode: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>姓名</span>
            <input
              placeholder="请输入姓名"
              value={form.employeeName}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, employeeName: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>证件号</span>
            <input
              placeholder="请输入证件号"
              value={form.idNumber}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, idNumber: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>入职日期</span>
            <input
              type="date"
              value={form.hireDate ?? ""}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, hireDate: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>离职日期</span>
            <input
              type="date"
              value={form.leaveDate ?? ""}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, leaveDate: event.target.value }))
              }
            />
          </label>
          <label className="form-field">
            <span>备注</span>
            <input
              placeholder="可选备注"
              value={form.remark ?? ""}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, remark: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="button-row">
          <button
            className="primary-button"
            disabled={submitting}
            onClick={() => void upsertEmployee()}
          >
            {selectedEmployee ? "保存修改" : "新增员工"}
          </button>
          <button className="ghost-button" disabled={submitting} onClick={resetForm}>
            清空表单
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </CollapsibleSectionCard>

      <ImportWorkflowSection
        title="员工批量导入"
        description="在员工信息模块内完成员工模板下载、预览、冲突处理和执行导入。"
        importType="employee"
        canOperate={Boolean(currentUnitId)}
        currentUnitId={currentUnitId}
        downloadButtonLabel="下载员工模板"
        groupTitle="员工批量导入工作区"
        groupDescription="默认收起，展开后处理模板下载、导入预览和导入回执。"
        defaultCollapsed={true}
        onDownloadTemplate={() => downloadEmployeeImportTemplateWorkbook()}
        onImportCommitted={() => loadEmployees()}
      />

      <CollapsibleSectionCard
        description={`当前单位员工总数：${employees.length}，点击条目可编辑。`}
        headerExtras={<span className="tag">{loading ? "加载中" : "已同步"}</span>}
        title="员工列表"
      >
        <div className="unit-list">
          {employees.length ? (
            employees.map((employee) => {
              const status = deriveEmployeeGeneralStatus(employee);
              return (
                <div
                  className={
                    selectedEmployeeId === employee.id ? "unit-item selected-item" : "unit-item"
                  }
                  key={employee.id}
                >
                  <div>
                    <strong>
                      {employee.employeeName}（{employee.employeeCode}）
                    </strong>
                    <p>证件号：{employee.idNumber}</p>
                    <p>
                      入职：{employee.hireDate || "-"} / 离职：{employee.leaveDate || "-"}
                    </p>
                    <p>
                      状态：
                      <span className={status === "active" ? "tag" : "tag tag-warning"}>
                        {generalStatusLabelMap[status]}
                      </span>
                    </p>
                  </div>

                  <div className="button-row compact">
                    <button className="ghost-button" onClick={() => startEdit(employee)}>
                      编辑
                    </button>
                    <button
                      className="danger-button"
                      disabled={submitting}
                      onClick={() => void removeEmployee(employee.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">当前单位还没有员工，请先新增员工。</div>
          )}
        </div>
      </CollapsibleSectionCard>
    </section>
  );
};
