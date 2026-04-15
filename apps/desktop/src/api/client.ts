import type {
  AnnualTaxCalculation,
  AnnualTaxExportPreviewRow,
  AnnualTaxResultVersion,
  AnnualTaxWithholdingContext,
  AppContext,
  BatchUpsertEmployeeYearRecordsPayload,
  ConfirmedAnnualResultDetail,
  ConfirmedAnnualResultSummary,
  CreateEmployeePayload,
  CreateUnitPayload,
  DeleteUnitChallenge,
  Employee,
  EmployeeAnnualTaxResult,
  EmployeeCalculationStatus,
  EmployeeYearRecordWorkspace,
  EmployeeMonthRecord,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  HistoryResultRecalculationResponse,
  ImportCommitResponse,
  ImportConflictStrategy,
  ImportPreviewResponse,
  ImportType,
  MonthConfirmationState,
  NavigationOrderResponse,
  QuickCalculatePayload,
  TaxPolicyResponse,
  TaxPolicySaveResponse,
  TaxPolicyVersionRenamePayload,
  TaxPolicyUpdatePayload,
  TaxPolicyVersionImpactPreview,
  CreateUnitBackupPayload,
  CreateUnitBackupResponse,
  FloatingDialogLayout,
  UnitBackupDraftResponse,
  Unit,
  UpdateAnnualResultSelectedSchemePayload,
  UpsertEmployeeMonthRecordPayload,
  WorkspaceCardLayout,
  WorkspaceDialogScope,
  WorkspaceLayoutState,
  WorkspacePageScope,
  YearEntryCalculationResponse,
  YearEntryOverviewResponse,
} from "@dude-tax/core";

const resolveApiBaseUrl = () =>
  window.salaryTaxDesktop?.runtimeConfig.apiBaseUrl ||
  new URLSearchParams(window.location.search).get("salaryTaxApiBaseUrl") ||
  import.meta.env.VITE_API_BASE_URL ||
  window.location.origin;

const buildRequestHeaders = (init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init?.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...init,
    headers: buildRequestHeaders(init),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    if (response.status === 413) {
      throw new Error("上传内容过大，请压缩图片或减少提交内容后重试");
    }
    throw new Error(errorBody?.message ?? "请求失败");
  }

  return response.json() as Promise<T>;
};

export const apiClient = {
  getContext() {
    return request<AppContext>("/api/context");
  },

  updateContext(payload: Partial<Pick<AppContext, "currentUnitId" | "currentTaxYear">>) {
    return request<AppContext>("/api/context", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  getSidebarPreference() {
    return request<{ collapsed: boolean }>("/api/ui-preferences/sidebar");
  },

  updateSidebarPreference(collapsed: boolean) {
    return request<{ collapsed: boolean }>("/api/ui-preferences/sidebar", {
      method: "PUT",
      body: JSON.stringify({ collapsed }),
    });
  },

  getNavigationOrderPreference() {
    return request<NavigationOrderResponse>("/api/ui-preferences/navigation-order");
  },

  updateNavigationOrderPreference(order: string[]) {
    return request<NavigationOrderResponse>("/api/ui-preferences/navigation-order", {
      method: "PUT",
      body: JSON.stringify({ order }),
    });
  },

  getWorkspaceLayout(scope: WorkspacePageScope) {
    return request<WorkspaceLayoutState>(`/api/ui-preferences/layouts/${scope}`);
  },

  updateWorkspaceLayout(
    scope: WorkspacePageScope,
    state: {
      cards: WorkspaceCardLayout[];
      collapsedSections?: Record<string, boolean>;
    },
  ) {
    return request<WorkspaceLayoutState>(`/api/ui-preferences/layouts/${scope}`, {
      method: "PUT",
      body: JSON.stringify(state),
    });
  },

  resetWorkspaceLayout(scope: WorkspacePageScope) {
    return request<{ success: boolean }>(`/api/ui-preferences/layouts/${scope}`, {
      method: "DELETE",
    });
  },

  getFloatingDialogLayout(scope: WorkspaceDialogScope) {
    return request<FloatingDialogLayout | null>(`/api/ui-preferences/dialogs/${scope}`);
  },

  updateFloatingDialogLayout(
    scope: WorkspaceDialogScope,
    layout: Omit<FloatingDialogLayout, "scope">,
  ) {
    return request<FloatingDialogLayout>(`/api/ui-preferences/dialogs/${scope}`, {
      method: "PUT",
      body: JSON.stringify(layout),
    });
  },

  resetFloatingDialogLayout(scope: WorkspaceDialogScope) {
    return request<{ success: boolean }>(`/api/ui-preferences/dialogs/${scope}`, {
      method: "DELETE",
    });
  },

  listUnits() {
    return request<Unit[]>("/api/units");
  },

  createUnit(payload: CreateUnitPayload) {
    return request<Unit>("/api/units", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  addUnitYear(unitId: number, taxYear: number) {
    return request<Unit>(`/api/units/${unitId}/years`, {
      method: "POST",
      body: JSON.stringify({ taxYear }),
    });
  },

  deleteUnitYear(unitId: number, taxYear: number) {
    return request<Unit>(`/api/units/${unitId}/years/${taxYear}`, {
      method: "DELETE",
    });
  },

  createDeleteChallenge(unitId: number) {
    return request<DeleteUnitChallenge>(`/api/units/${unitId}/delete-challenge`, {
      method: "POST",
    });
  },

  deleteUnit(unitId: number, challengeId: string, confirmationCode: string) {
    return request<{ success: boolean }>(`/api/units/${unitId}`, {
      method: "DELETE",
      body: JSON.stringify({
        challengeId,
        confirmationCode,
        acknowledgeIrreversible: true,
      }),
    });
  },

  getUnitBackupDraft(unitId: number) {
    return request<UnitBackupDraftResponse>(`/api/units/${unitId}/backup-draft`);
  },

  createUnitBackup(unitId: number, payload: CreateUnitBackupPayload) {
    return request<CreateUnitBackupResponse>(`/api/units/${unitId}/backup`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listEmployees(unitId: number) {
    return request<Employee[]>(`/api/units/${unitId}/employees`);
  },

  createEmployee(unitId: number, payload: CreateEmployeePayload) {
    return request<Employee>(`/api/units/${unitId}/employees`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateEmployee(employeeId: number, payload: CreateEmployeePayload) {
    return request<Employee>(`/api/employees/${employeeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteEmployee(employeeId: number) {
    return request<{ success: boolean }>(`/api/employees/${employeeId}`, {
      method: "DELETE",
    });
  },

  listMonthRecords(unitId: number, taxYear: number, employeeId: number) {
    return request<EmployeeMonthRecord[]>(
      `/api/units/${unitId}/years/${taxYear}/employees/${employeeId}/month-records`,
    );
  },

  upsertMonthRecord(
    unitId: number,
    taxYear: number,
    employeeId: number,
    taxMonth: number,
    payload: UpsertEmployeeMonthRecordPayload,
  ) {
    return request<EmployeeMonthRecord>(
      `/api/units/${unitId}/years/${taxYear}/employees/${employeeId}/month-records/${taxMonth}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
  },

  getYearEntryOverview(unitId: number, taxYear: number) {
    return request<YearEntryOverviewResponse>(
      `/api/units/${unitId}/years/${taxYear}/year-entry-overview`,
    );
  },

  calculateYearEntryResults(
    unitId: number,
    taxYear: number,
    payload: {
      employeeIds: number[];
      withholdingContext?: AnnualTaxWithholdingContext;
    },
  ) {
    return request<YearEntryCalculationResponse>(
      `/api/units/${unitId}/years/${taxYear}/year-entry-calculate`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  getEmployeeYearWorkspace(unitId: number, taxYear: number, employeeId: number) {
    return request<EmployeeYearRecordWorkspace>(
      `/api/units/${unitId}/years/${taxYear}/employees/${employeeId}/year-record-workspace`,
    );
  },

  saveEmployeeYearWorkspace(
    unitId: number,
    taxYear: number,
    employeeId: number,
    payload: BatchUpsertEmployeeYearRecordsPayload,
  ) {
    return request<EmployeeYearRecordWorkspace>(
      `/api/units/${unitId}/years/${taxYear}/employees/${employeeId}/year-record-workspace`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
  },

  getMonthConfirmationState(unitId: number, taxYear: number) {
    return request<MonthConfirmationState>(
      `/api/units/${unitId}/years/${taxYear}/month-confirmations`,
    );
  },

  confirmMonth(unitId: number, taxYear: number, taxMonth: number) {
    return request<MonthConfirmationState>(
      `/api/units/${unitId}/years/${taxYear}/month-confirmations/${taxMonth}/confirm`,
      {
        method: "POST",
      },
    );
  },

  unconfirmMonth(unitId: number, taxYear: number, taxMonth: number) {
    return request<MonthConfirmationState>(
      `/api/units/${unitId}/years/${taxYear}/month-confirmations/${taxMonth}/unconfirm`,
      {
        method: "POST",
      },
    );
  },

  listConfirmedResults(unitId: number, taxYear: number, throughMonth?: number) {
    const searchParams = new URLSearchParams();
    if (throughMonth) {
      searchParams.set("throughMonth", String(throughMonth));
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<ConfirmedAnnualResultSummary[]>(
      `/api/units/${unitId}/years/${taxYear}/confirmed-results${suffix}`,
    );
  },

  getConfirmedResultDetail(
    unitId: number,
    taxYear: number,
    employeeId: number,
    throughMonth?: number,
  ) {
    const searchParams = new URLSearchParams();
    if (throughMonth) {
      searchParams.set("throughMonth", String(throughMonth));
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<ConfirmedAnnualResultDetail>(
      `/api/units/${unitId}/years/${taxYear}/confirmed-results/${employeeId}${suffix}`,
    );
  },

  getTaxPolicy(unitId?: number, taxYear?: number) {
    const searchParams = new URLSearchParams();
    if (unitId) {
      searchParams.set("unitId", String(unitId));
    }
    if (taxYear) {
      searchParams.set("taxYear", String(taxYear));
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<TaxPolicyResponse>(`/api/tax-policy${suffix}`);
  },

  updateTaxPolicy(payload: TaxPolicyUpdatePayload) {
    return request<TaxPolicySaveResponse>("/api/tax-policy", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  renameTaxPolicyVersion(versionId: number, payload: TaxPolicyVersionRenamePayload) {
    return request<TaxPolicySaveResponse>(`/api/tax-policy/versions/${versionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  activateTaxPolicyVersion(versionId: number) {
    return request<TaxPolicySaveResponse>(`/api/tax-policy/versions/${versionId}/activate`, {
      method: "POST",
    });
  },

  bindTaxPolicyVersionToScope(versionId: number, unitId: number, taxYear: number) {
    return request<TaxPolicySaveResponse>(`/api/tax-policy/versions/${versionId}/bind-scope`, {
      method: "POST",
      body: JSON.stringify({
        unitId,
        taxYear,
      }),
    });
  },

  getTaxPolicyVersionImpactPreview(versionId: number, unitId: number, taxYear: number) {
    const searchParams = new URLSearchParams({
      unitId: String(unitId),
      taxYear: String(taxYear),
    });
    return request<TaxPolicyVersionImpactPreview>(
      `/api/tax-policy/versions/${versionId}/impact-preview?${searchParams.toString()}`,
    );
  },

  unbindCurrentScopeTaxPolicy(unitId: number, taxYear: number) {
    return request<TaxPolicySaveResponse>("/api/tax-policy/scopes/current/unbind", {
      method: "POST",
      body: JSON.stringify({
        unitId,
        taxYear,
      }),
    });
  },

  quickCalculate(payload: QuickCalculatePayload) {
    return request<AnnualTaxCalculation>("/api/quick-calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  downloadImportTemplate(importType: ImportType, unitId?: number, taxYear?: number) {
    const searchParams = new URLSearchParams();
    if (unitId) {
      searchParams.set("unitId", String(unitId));
    }
    if (taxYear) {
      searchParams.set("taxYear", String(taxYear));
    }
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return fetch(`${resolveApiBaseUrl()}/api/import/templates/${importType}${suffix}`).then(
      (response) => {
        if (!response.ok) {
          throw new Error("下载导入模板失败");
        }
        return response.text();
      },
    );
  },

  previewImport(importType: ImportType, unitId: number, csvText: string, scopeTaxYear?: number) {
    return request<ImportPreviewResponse>("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        importType,
        unitId,
        scopeTaxYear,
        csvText,
      }),
    });
  },

  commitImport(
    importType: ImportType,
    unitId: number,
    csvText: string,
    conflictStrategy: ImportConflictStrategy,
    scopeTaxYear?: number,
  ) {
    return request<ImportCommitResponse>("/api/import/commit", {
      method: "POST",
      body: JSON.stringify({
        importType,
        unitId,
        scopeTaxYear,
        csvText,
        conflictStrategy,
      }),
    });
  },

  listCalculationStatuses(unitId: number, taxYear: number) {
    return request<EmployeeCalculationStatus[]>(
      `/api/units/${unitId}/years/${taxYear}/calculation-statuses`,
    );
  },

  recalculateStatuses(
    unitId: number,
    taxYear: number,
    employeeId?: number,
    withholdingContext?: AnnualTaxWithholdingContext,
  ) {
    return request<EmployeeCalculationStatus[]>(
      `/api/units/${unitId}/years/${taxYear}/calculation-statuses/recalculate`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(employeeId ? { employeeId } : {}),
          ...(withholdingContext ? { withholdingContext } : {}),
        }),
      },
    );
  },

  listAnnualResults(unitId: number, taxYear: number) {
    return request<EmployeeAnnualTaxResult[]>(
      `/api/units/${unitId}/years/${taxYear}/annual-results`,
    );
  },

  listAnnualResultVersions(unitId: number, taxYear: number, employeeId: number) {
    return request<AnnualTaxResultVersion[]>(
      `/api/units/${unitId}/years/${taxYear}/employees/${employeeId}/annual-result-versions`,
    );
  },

  listAnnualResultExportPreview(unitId: number, taxYear: number) {
    return request<AnnualTaxExportPreviewRow[]>(
      `/api/units/${unitId}/years/${taxYear}/annual-results/export-preview`,
    );
  },

  searchHistoryResults(query: HistoryAnnualTaxQuery) {
    const searchParams = new URLSearchParams();
    if (query.unitId) {
      searchParams.set("unitId", String(query.unitId));
    }
    if (query.taxYear) {
      searchParams.set("taxYear", String(query.taxYear));
    }
    if (query.employeeId) {
      searchParams.set("employeeId", String(query.employeeId));
    }
    if (query.settlementDirection) {
      searchParams.set("settlementDirection", query.settlementDirection);
    }
    if (query.resultStatus) {
      searchParams.set("resultStatus", query.resultStatus);
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<HistoryAnnualTaxResult[]>(`/api/history-results${suffix}`);
  },

  recalculateHistoryResult(unitId: number, taxYear: number, employeeId: number) {
    return request<HistoryResultRecalculationResponse>("/api/history-results/recalculate", {
      method: "POST",
      body: JSON.stringify({
        unitId,
        taxYear,
        employeeId,
      }),
    });
  },

  updateAnnualResultSelectedScheme(
    unitId: number,
    taxYear: number,
    employeeId: number,
    payload: UpdateAnnualResultSelectedSchemePayload,
  ) {
    return request<EmployeeAnnualTaxResult>(
      `/api/units/${unitId}/years/${taxYear}/annual-results/${employeeId}/selected-scheme`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
  },
};
