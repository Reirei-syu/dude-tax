import type { CreateEmployeePayload, Employee } from "@dude-tax/core";
import { deriveEmployeeRosterStatus } from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { EmployeeEditDialog } from "../components/EmployeeEditDialog";
import { ImportWorkflowSection } from "../components/ImportWorkflowSection";
import { WorkspaceCanvas, WorkspaceItem, WorkspaceLayoutRoot } from "../components/WorkspaceLayout";
import { useAppContext } from "../context/AppContextProvider";
import { downloadEmployeeImportTemplateWorkbook } from "./import-template";
import {
  buildEmployeeRosterStatusLabel,
  buildEmployeeRosterStatusTagClass,
  filterEmployeeListByFormerEmployeeVisibility,
} from "./employee-list-filter";

const emptyForm: CreateEmployeePayload = {
  employeeCode: "",
  employeeName: "",
  idNumber: "",
  hireDate: "",
  leaveDate: "",
  remark: "",
};

const buildEmployeeForm = (employee: Employee): CreateEmployeePayload => ({
  employeeCode: employee.employeeCode,
  employeeName: employee.employeeName,
  idNumber: employee.idNumber,
  hireDate: employee.hireDate ?? "",
  leaveDate: employee.leaveDate ?? "",
  remark: employee.remark,
});

const validateEmployeeForm = (form: CreateEmployeePayload) => {
  if (!form.employeeCode.trim() || !form.employeeName.trim() || !form.idNumber.trim()) {
    return "工号、姓名、证件号不能为空";
  }

  return null;
};

type EmployeeFormFieldsProps = {
  form: CreateEmployeePayload;
  onChange: (key: keyof CreateEmployeePayload, value: string) => void;
};

const EmployeeFormFields = ({ form, onChange }: EmployeeFormFieldsProps) => (
  <div className="form-grid">
    <label className="form-field">
      <span>工号</span>
      <input
        placeholder="请输入工号"
        value={form.employeeCode}
        onChange={(event) => onChange("employeeCode", event.target.value)}
      />
    </label>
    <label className="form-field">
      <span>姓名</span>
      <input
        placeholder="请输入姓名"
        value={form.employeeName}
        onChange={(event) => onChange("employeeName", event.target.value)}
      />
    </label>
    <label className="form-field">
      <span>证件号</span>
      <input
        placeholder="请输入证件号"
        value={form.idNumber}
        onChange={(event) => onChange("idNumber", event.target.value)}
      />
    </label>
    <label className="form-field">
      <span>入职日期</span>
      <input
        type="date"
        value={form.hireDate ?? ""}
        onChange={(event) => onChange("hireDate", event.target.value)}
      />
    </label>
    <label className="form-field">
      <span>离职日期</span>
      <input
        type="date"
        value={form.leaveDate ?? ""}
        onChange={(event) => onChange("leaveDate", event.target.value)}
      />
    </label>
    <label className="form-field">
      <span>备注</span>
      <input
        placeholder="可选备注"
        value={form.remark ?? ""}
        onChange={(event) => onChange("remark", event.target.value)}
      />
    </label>
  </div>
);

export const EmployeeManagementPage = () => {
  const { context } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateEmployeePayload>(emptyForm);
  const [editForm, setEditForm] = useState<CreateEmployeePayload>(emptyForm);
  const [hideFormerEmployees, setHideFormerEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? new Date().getUTCFullYear();
  const currentUnit = useMemo(
    () => context?.units.find((unit) => unit.id === currentUnitId) ?? null,
    [context, currentUnitId],
  );

  const editingEmployee = useMemo(
    () => employees.find((employee) => employee.id === editingEmployeeId) ?? null,
    [employees, editingEmployeeId],
  );

  const visibleEmployees = useMemo(
    () =>
      filterEmployeeListByFormerEmployeeVisibility(
        employees,
        currentTaxYear,
        hideFormerEmployees,
      ),
    [employees, currentTaxYear, hideFormerEmployees],
  );

  const resetCreateForm = () => {
    setCreateForm(emptyForm);
  };

  const closeEditDialog = () => {
    setEditingEmployeeId(null);
    setEditForm(emptyForm);
    setEditErrorMessage(null);
  };

  const updateCreateForm = (key: keyof CreateEmployeePayload, value: string) => {
    setCreateForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const updateEditForm = (key: keyof CreateEmployeePayload, value: string) => {
    setEditForm((currentForm) => ({ ...currentForm, [key]: value }));
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
    resetCreateForm();
    closeEditDialog();
    void loadEmployees();
  }, [currentUnitId]);

  const createEmployee = async () => {
    if (!currentUnitId) {
      setErrorMessage("请先选择单位");
      return;
    }

    const validationMessage = validateEmployeeForm(createForm);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await apiClient.createEmployee(currentUnitId, createForm);
      await loadEmployees();
      resetCreateForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增员工失败");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEditedEmployee = async () => {
    if (!editingEmployeeId) {
      setEditErrorMessage("未选择要编辑的员工");
      return;
    }

    const validationMessage = validateEmployeeForm(editForm);
    if (validationMessage) {
      setEditErrorMessage(validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      setEditErrorMessage(null);
      await apiClient.updateEmployee(editingEmployeeId, editForm);
      await loadEmployees();
      closeEditDialog();
    } catch (error) {
      setEditErrorMessage(error instanceof Error ? error.message : "保存员工失败");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEditForm(buildEmployeeForm(employee));
    setEditErrorMessage(null);
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
      if (editingEmployeeId === employeeId) {
        closeEditDialog();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除员工失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUnitId) {
    return (
      <WorkspaceLayoutRoot scope="page:employees">
        <WorkspaceCanvas>
          <WorkspaceItem cardId="employees-create" defaultLayout={{ x: 0, y: 0, w: 12, h: 10 }} minH={8}>
            <CollapsibleSectionCard
              cardId="employees-create"
              className="placeholder-card"
              description="请先在顶部选择单位，再进入员工信息模块。"
              headingTag="h1"
              title="员工信息"
            />
          </WorkspaceItem>
        </WorkspaceCanvas>
      </WorkspaceLayoutRoot>
    );
  }

  return (
    <WorkspaceLayoutRoot scope="page:employees">
      <WorkspaceCanvas>
        <WorkspaceItem
          cardId="employees-create"
          defaultLayout={{ x: 0, y: 0, w: 5, h: 14 }}
          minH={12}
        >
          <CollapsibleSectionCard
            cardId="employees-create"
            description={`当前仅维护 ${currentUnit?.unitName ?? "当前单位"} 下的员工基础档案。`}
            headingTag="h1"
            headerExtras={<span className="tag">新增员工</span>}
            title="员工信息"
          >
            <EmployeeFormFields form={createForm} onChange={updateCreateForm} />

            <div className="button-row">
              <button
                className="primary-button"
                disabled={submitting}
                onClick={() => void createEmployee()}
              >
                新增员工
              </button>
              <button className="ghost-button" disabled={submitting} onClick={resetCreateForm}>
                清空表单
              </button>
            </div>

            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="employees-import"
          defaultLayout={{ x: 5, y: 0, w: 7, h: 14 }}
          minH={12}
        >
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
        </WorkspaceItem>

        <WorkspaceItem
          cardId="employees-list"
          defaultLayout={{ x: 0, y: 14, w: 12, h: 18 }}
          minH={14}
        >
          <CollapsibleSectionCard
            cardId="employees-list"
            description={`当前单位员工总数：${employees.length}，当前显示：${visibleEmployees.length}。`}
            headerExtras={<span className="tag">{loading ? "加载中" : "已同步"}</span>}
            title="员工列表"
          >
            <label className="checkbox-row checkbox-row-inline">
              <input
                checked={hideFormerEmployees}
                type="checkbox"
                onChange={(event) => setHideFormerEmployees(event.target.checked)}
              />
              <span>隐藏已离职员工</span>
            </label>

            <div className="unit-list">
              {visibleEmployees.length ? (
                visibleEmployees.map((employee) => {
                  const status = deriveEmployeeRosterStatus(employee, currentTaxYear);
                  return (
                    <div
                      className={
                        editingEmployeeId === employee.id ? "unit-item selected-item" : "unit-item"
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
                          <span className={buildEmployeeRosterStatusTagClass(status)}>
                            {buildEmployeeRosterStatusLabel(employee, currentTaxYear)}
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
              ) : employees.length ? (
                <div className="empty-state">当前仅剩已离职员工，可关闭隐藏开关后查看。</div>
              ) : (
                <div className="empty-state">当前单位还没有员工，请先新增员工。</div>
              )}
            </div>
          </CollapsibleSectionCard>
        </WorkspaceItem>
      </WorkspaceCanvas>

      <EmployeeEditDialog
        description="通过独立对话框编辑已有员工档案，不影响下方新增员工表单。"
        errorMessage={editErrorMessage}
        open={Boolean(editingEmployee)}
        primaryActionLabel="保存修改"
        submitting={submitting}
        title={editingEmployee ? `编辑员工：${editingEmployee.employeeName}` : "编辑员工"}
        onClose={closeEditDialog}
        onSubmit={() => void saveEditedEmployee()}
      >
        <EmployeeFormFields form={editForm} onChange={updateEditForm} />
      </EmployeeEditDialog>
    </WorkspaceLayoutRoot>
  );
};
