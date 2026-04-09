import type {
  AnnualTaxCalculation,
  AnnualTaxExportPreviewRow,
  AnnualTaxResultVersion,
  AnnualTaxWithholdingContext,
  AppContext,
  CreateEmployeePayload,
  CreateUnitPayload,
  DeleteUnitChallenge,
  Employee,
  EmployeeAnnualTaxResult,
  EmployeeCalculationStatus,
  EmployeeMonthRecord,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  HistoryResultRecalculationResponse,
  ImportCommitResponse,
  ImportConflictStrategy,
  ImportPreviewResponse,
  ImportSummary,
  ImportType,
  QuickCalculatePayload,
  TaxPolicyResponse,
  TaxPolicySaveResponse,
  TaxPolicyUpdatePayload,
  TaxPolicyVersionImpactPreview,
  Unit,
  UpdateAnnualResultSelectedSchemePayload,
  UpsertEmployeeMonthRecordPayload,
} from "@dude-tax/core";

const resolveApiBaseUrl = () =>
  window.salaryTaxDesktop?.runtimeConfig.apiBaseUrl ||
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
    return fetch(`${resolveApiBaseUrl()}/api/import/templates/${importType}${suffix}`).then((response) => {
      if (!response.ok) {
        throw new Error("下载导入模板失败");
      }
      return response.text();
    });
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

  getImportSummary(unitId: number) {
    return request<ImportSummary | null>(`/api/import/summary?unitId=${unitId}`);
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
