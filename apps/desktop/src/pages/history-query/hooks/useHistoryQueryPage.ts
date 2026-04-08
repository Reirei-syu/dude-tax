import type {
  AnnualTaxResultVersion,
  AppContext,
  Employee,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  HistoryResultRecalculationResponse,
  HistoryResultStatus,
  TaxSettlementDirection,
} from "@dude-tax/core";
import { getSelectableYears } from "@dude-tax/config";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../api/client";
import {
  buildHistoryQueryExportCsv,
  buildHistoryQueryExportFilename,
  buildHistoryQueryExportWorkbookBuffer,
  buildHistoryQueryExportWorkbookFilename,
} from "../../history-query-export";
import { buildHistoryQueryYearSummaries } from "../../history-query-year-summary";
import { buildAnnualTaxRuleSourceExplanation } from "../../annual-tax-rule-source-summary";
import { buildAnnualTaxWithholdingExplanation } from "../../annual-tax-withholding-summary";
import { saveFileWithDesktopFallback } from "../../../utils/file-save";
import { buildHistoryQueryExportScopeLabel } from "../constants";

export const useHistoryQueryPage = (context: AppContext | null) => {
  const years = getSelectableYears();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [results, setResults] = useState<HistoryAnnualTaxResult[]>([]);
  const [versionHistory, setVersionHistory] = useState<AnnualTaxResultVersion[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [versionHistoryErrorMessage, setVersionHistoryErrorMessage] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] =
    useState<HistoryResultRecalculationResponse | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonErrorMessage, setComparisonErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryAnnualTaxQuery>({
    unitId: context?.currentUnitId ?? undefined,
    taxYear: context?.currentTaxYear ?? undefined,
  });

  useEffect(() => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      unitId: currentFilters.unitId ?? context?.currentUnitId ?? undefined,
      taxYear: currentFilters.taxYear ?? context?.currentTaxYear ?? undefined,
    }));
  }, [context?.currentTaxYear, context?.currentUnitId]);

  const loadEmployees = async (unitId?: number) => {
    if (!unitId) {
      setEmployees([]);
      return;
    }

    try {
      const nextEmployees = await apiClient.listEmployees(unitId);
      setEmployees(nextEmployees);
    } catch {
      setEmployees([]);
    }
  };

  const loadHistoryResults = async (query: HistoryAnnualTaxQuery) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextResults = await apiClient.searchHistoryResults(query);
      setResults(nextResults);
      setSelectedResultId(
        nextResults[0]
          ? `${nextResults[0].unitId}-${nextResults[0].employeeId}-${nextResults[0].taxYear}`
          : null,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载历史结果失败");
      setResults([]);
      setSelectedResultId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees(filters.unitId);
  }, [filters.unitId]);

  useEffect(() => {
    void loadHistoryResults(filters);
  }, [filters]);

  const selectedResult =
    results.find(
      (result) => `${result.unitId}-${result.employeeId}-${result.taxYear}` === selectedResultId,
    ) ??
    results[0] ??
    null;

  useEffect(() => {
    const loadVersionHistory = async () => {
      if (!selectedResult) {
        setVersionHistory([]);
        setVersionHistoryErrorMessage(null);
        return;
      }

      try {
        setVersionHistoryLoading(true);
        setVersionHistoryErrorMessage(null);
        const nextVersions = await apiClient.listAnnualResultVersions(
          selectedResult.unitId,
          selectedResult.taxYear,
          selectedResult.employeeId,
        );
        setVersionHistory(nextVersions);
      } catch (error) {
        setVersionHistory([]);
        setVersionHistoryErrorMessage(error instanceof Error ? error.message : "加载版本历史失败");
      } finally {
        setVersionHistoryLoading(false);
      }
    };

    void loadVersionHistory();
  }, [selectedResult]);

  useEffect(() => {
    const loadComparison = async () => {
      if (!selectedResult?.isInvalidated) {
        setComparisonResult(null);
        setComparisonErrorMessage(null);
        return;
      }

      try {
        setComparisonLoading(true);
        setComparisonErrorMessage(null);
        const nextComparison = await apiClient.recalculateHistoryResult(
          selectedResult.unitId,
          selectedResult.taxYear,
          selectedResult.employeeId,
        );
        setComparisonResult(nextComparison);
      } catch (error) {
        setComparisonResult(null);
        setComparisonErrorMessage(error instanceof Error ? error.message : "计算对比结果失败");
      } finally {
        setComparisonLoading(false);
      }
    };

    void loadComparison();
  }, [selectedResult]);

  const updateFilter = <T extends keyof HistoryAnnualTaxQuery>(
    key: T,
    value: HistoryAnnualTaxQuery[T],
  ) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
      ...(key === "unitId" ? { employeeId: undefined } : {}),
    }));
  };

  const summary = useMemo(
    () => ({
      total: results.length,
      current: results.filter((result) => !result.isInvalidated).length,
      invalidated: results.filter((result) => result.isInvalidated).length,
      payable: results.filter((result) => result.settlementDirection === "payable").length,
      refund: results.filter((result) => result.settlementDirection === "refund").length,
      balanced: results.filter((result) => result.settlementDirection === "balanced").length,
      unitCount: new Set(results.map((result) => result.unitId)).size,
      employeeCount: new Set(results.map((result) => result.employeeId)).size,
      yearCount: new Set(results.map((result) => result.taxYear)).size,
    }),
    [results],
  );

  const comparisonItems =
    selectedResult && comparisonResult && selectedResult.isInvalidated
      ? comparisonResult.comparisonItems
      : [];
  const selectedWithholdingExplanation = selectedResult
    ? buildAnnualTaxWithholdingExplanation(selectedResult.withholdingSummary)
    : null;
  const selectedRuleSourceExplanation = selectedResult
    ? buildAnnualTaxRuleSourceExplanation(selectedResult)
    : null;
  const yearSummaries = useMemo(() => buildHistoryQueryYearSummaries(results), [results]);

  const selectedUnitName =
    context?.units.find((unit) => unit.id === filters.unitId)?.unitName ?? undefined;
  const exportScopeLabel = buildHistoryQueryExportScopeLabel(
    selectedUnitName,
    filters.taxYear,
    filters.resultStatus,
  );

  const downloadHistoryCsv = () => {
    if (!results.length) {
      return;
    }

    const csvContent = buildHistoryQueryExportCsv(results);
    void saveFileWithDesktopFallback({
      defaultPath: buildHistoryQueryExportFilename(exportScopeLabel),
      filters: [{ name: "CSV 文件", extensions: ["csv"] }],
      mimeType: "text/csv;charset=utf-8;",
      content: `\uFEFF${csvContent}`,
    });
  };

  const downloadHistoryWorkbook = async () => {
    if (!results.length) {
      return;
    }

    const workbookArray = await buildHistoryQueryExportWorkbookBuffer(results);
    await saveFileWithDesktopFallback({
      defaultPath: buildHistoryQueryExportWorkbookFilename(exportScopeLabel),
      filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: workbookArray,
    });
  };

  return {
    years,
    employees,
    results,
    versionHistory,
    selectedResultId,
    selectedResult,
    loading,
    versionHistoryLoading,
    errorMessage,
    versionHistoryErrorMessage,
    comparisonResult,
    comparisonLoading,
    comparisonErrorMessage,
    filters,
    summary,
    comparisonItems,
    selectedWithholdingExplanation,
    selectedRuleSourceExplanation,
    yearSummaries,
    loadEmployees,
    loadHistoryResults,
    setSelectedResultId,
    updateFilter,
    downloadHistoryCsv,
    downloadHistoryWorkbook,
  };
};

export type HistoryQueryPageData = ReturnType<typeof useHistoryQueryPage>;
export type HistoryQuerySettlementDirection = TaxSettlementDirection;
export type HistoryQueryResultStatus = HistoryResultStatus;
