import type {
  AnnualTaxExportPreviewRow,
  AnnualTaxResultVersion,
  AppContext,
  EmployeeCalculationStatus,
  EmployeeAnnualTaxResult,
  TaxCalculationScheme,
} from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../api/client";
import {
  ANNUAL_TAX_EXPORT_TEMPLATES,
  buildAnnualTaxExportCsv,
  buildAnnualTaxExportFilename,
  buildAnnualTaxExportWorkbookBuffer,
  buildAnnualTaxExportWorkbookFilename,
  DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS,
  DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID,
  type AnnualTaxExportColumnKey,
  type AnnualTaxExportTemplateId,
} from "../../annual-tax-export";
import { buildAnnualTaxExplanation } from "../../annual-tax-explanation";
import { buildAnnualTaxExportSelectionSummary } from "../../annual-tax-export-template-manager";
import { buildAnnualResultVersionComparisonItems } from "../../annual-result-version-diff";
import { buildAnnualTaxRuleSourceExplanation } from "../../annual-tax-rule-source-summary";
import { buildAnnualTaxWithholdingExplanation } from "../../annual-tax-withholding-summary";
import { saveFileWithDesktopFallback } from "../../../utils/file-save";
import { buildVersionOptions, getSelectedSchemeResult } from "../constants";

export const useAnnualResultsPage = (context: AppContext | null) => {
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [results, setResults] = useState<EmployeeAnnualTaxResult[]>([]);
  const [resultVersions, setResultVersions] = useState<AnnualTaxResultVersion[]>([]);
  const [exportPreviewRows, setExportPreviewRows] = useState<AnnualTaxExportPreviewRow[]>([]);
  const [statuses, setStatuses] = useState<EmployeeCalculationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [switchingScheme, setSwitchingScheme] = useState<TaxCalculationScheme | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportFeedbackMessage, setExportFeedbackMessage] = useState<string | null>(null);
  const [versionErrorMessage, setVersionErrorMessage] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedBaselineVersionId, setSelectedBaselineVersionId] = useState<number | null>(null);
  const [selectedTargetVersionId, setSelectedTargetVersionId] = useState<number | null>(null);
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState<
    AnnualTaxExportTemplateId | "custom"
  >(DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID);
  const [selectedExportColumnKeys, setSelectedExportColumnKeys] = useState<
    AnnualTaxExportColumnKey[]
  >(DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS);

  const loadResults = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setResults([]);
      setExportPreviewRows([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const [nextResults, nextExportPreviewRows, nextStatuses] = await Promise.all([
        apiClient.listAnnualResults(currentUnitId, currentTaxYear),
        apiClient.listAnnualResultExportPreview(currentUnitId, currentTaxYear),
        apiClient.listCalculationStatuses(currentUnitId, currentTaxYear),
      ]);
      setResults(nextResults);
      setExportPreviewRows(nextExportPreviewRows);
      setStatuses(nextStatuses);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载年度结果失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResults();
  }, [currentUnitId, currentTaxYear]);

  useEffect(() => {
    if (!results.length) {
      setSelectedEmployeeId(null);
      return;
    }

    const selectedExists = results.some((result) => result.employeeId === selectedEmployeeId);
    if (!selectedExists) {
      setSelectedEmployeeId(results[0]?.employeeId ?? null);
    }
  }, [results, selectedEmployeeId]);

  const selectedResult =
    results.find((result) => result.employeeId === selectedEmployeeId) ?? results[0] ?? null;
  const selectedSchemeResult = selectedResult ? getSelectedSchemeResult(selectedResult) : null;
  const selectedExplanation = selectedResult ? buildAnnualTaxExplanation(selectedResult) : null;
  const selectedWithholdingExplanation = selectedResult
    ? buildAnnualTaxWithholdingExplanation(selectedResult.withholdingSummary)
    : null;
  const selectedRuleSourceExplanation = selectedResult
    ? buildAnnualTaxRuleSourceExplanation(selectedResult)
    : null;
  const selectedExportPreviewRow =
    exportPreviewRows.find((row) => row.employeeId === selectedEmployeeId) ??
    exportPreviewRows[0] ??
    null;

  useEffect(() => {
    const loadResultVersions = async () => {
      if (!currentUnitId || !currentTaxYear || !selectedResult) {
        setResultVersions([]);
        setVersionErrorMessage(null);
        setSelectedBaselineVersionId(null);
        setSelectedTargetVersionId(null);
        return;
      }

      try {
        setVersionLoading(true);
        setVersionErrorMessage(null);
        const nextVersions = await apiClient.listAnnualResultVersions(
          currentUnitId,
          currentTaxYear,
          selectedResult.employeeId,
        );
        setResultVersions(nextVersions);
      } catch (error) {
        setResultVersions([]);
        setVersionErrorMessage(error instanceof Error ? error.message : "加载版本历史失败");
      } finally {
        setVersionLoading(false);
      }
    };

    void loadResultVersions();
  }, [currentTaxYear, currentUnitId, selectedResult]);

  useEffect(() => {
    if (!resultVersions.length) {
      setSelectedBaselineVersionId(null);
      setSelectedTargetVersionId(null);
      return;
    }

    if (resultVersions.length === 1) {
      setSelectedBaselineVersionId(resultVersions[0].versionId);
      setSelectedTargetVersionId(null);
      return;
    }

    const baselineVersion = resultVersions[1];
    const targetVersion = resultVersions[0];

    setSelectedBaselineVersionId((currentId) =>
      resultVersions.some((version) => version.versionId === currentId)
        ? currentId
        : (baselineVersion?.versionId ?? null),
    );
    setSelectedTargetVersionId((currentId) =>
      resultVersions.some((version) => version.versionId === currentId)
        ? currentId
        : (targetVersion?.versionId ?? null),
    );
  }, [resultVersions]);

  const switchSelectedScheme = async (selectedScheme: TaxCalculationScheme) => {
    if (!currentUnitId || !currentTaxYear || !selectedResult) {
      return;
    }

    try {
      setSwitchingScheme(selectedScheme);
      setErrorMessage(null);
      await apiClient.updateAnnualResultSelectedScheme(
        currentUnitId,
        currentTaxYear,
        selectedResult.employeeId,
        { selectedScheme },
      );
      await loadResults();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "切换结果方案失败");
    } finally {
      setSwitchingScheme(null);
    }
  };

  const summary = useMemo(
    () => ({
      total: results.length,
      separateBonus: results.filter((result) => result.selectedScheme === "separate_bonus").length,
      combinedBonus: results.filter((result) => result.selectedScheme === "combined_bonus").length,
      totalSelectedTax: results.reduce((sum, result) => sum + result.selectedTaxAmount, 0),
      invalidated: statuses.filter((status) => status.isInvalidated).length,
    }),
    [results, statuses],
  );

  const exportSelectionSummary = useMemo(
    () => buildAnnualTaxExportSelectionSummary(selectedExportColumnKeys),
    [selectedExportColumnKeys],
  );

  const toggleExportColumn = (columnKey: AnnualTaxExportColumnKey) => {
    setSelectedExportTemplateId("custom");
    setExportFeedbackMessage(null);
    setSelectedExportColumnKeys((currentKeys) => {
      if (currentKeys.includes(columnKey)) {
        return currentKeys.filter((key) => key !== columnKey);
      }

      return [...currentKeys, columnKey];
    });
  };

  const applyExportTemplate = (templateId: AnnualTaxExportTemplateId) => {
    const template = ANNUAL_TAX_EXPORT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedExportTemplateId(templateId);
    setSelectedExportColumnKeys(template.columnKeys);
    setExportFeedbackMessage(null);
  };

  const downloadExportPreview = () => {
    if (
      !exportPreviewRows.length ||
      !currentUnit ||
      !currentTaxYear ||
      !selectedExportColumnKeys.length
    ) {
      return;
    }

    const csvContent = buildAnnualTaxExportCsv(exportPreviewRows, selectedExportColumnKeys);
    void saveFileWithDesktopFallback({
      defaultPath: buildAnnualTaxExportFilename(currentUnit.unitName, currentTaxYear),
      filters: [{ name: "CSV 文件", extensions: ["csv"] }],
      mimeType: "text/csv;charset=utf-8;",
      content: `\uFEFF${csvContent}`,
    });
    setExportFeedbackMessage(
      `已按${exportSelectionSummary.matchedTemplateLabel ?? "自定义模板"}导出 CSV，共 ${selectedExportColumnKeys.length} 个字段。`,
    );
  };

  const downloadExportWorkbook = async () => {
    if (
      !exportPreviewRows.length ||
      !currentUnit ||
      !currentTaxYear ||
      !selectedExportColumnKeys.length
    ) {
      return;
    }

    const workbookArray = await buildAnnualTaxExportWorkbookBuffer(
      exportPreviewRows,
      selectedExportColumnKeys,
    );
    await saveFileWithDesktopFallback({
      defaultPath: buildAnnualTaxExportWorkbookFilename(currentUnit.unitName, currentTaxYear),
      filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: workbookArray,
    });
    setExportFeedbackMessage(
      `已按${exportSelectionSummary.matchedTemplateLabel ?? "自定义模板"}导出 XLSX，共 ${selectedExportColumnKeys.length} 个字段。`,
    );
  };

  const selectedBaselineVersion =
    resultVersions.find((version) => version.versionId === selectedBaselineVersionId) ?? null;
  const selectedTargetVersion =
    resultVersions.find((version) => version.versionId === selectedTargetVersionId) ?? null;
  const versionComparisonItems =
    selectedBaselineVersion &&
    selectedTargetVersion &&
    selectedBaselineVersion.versionId !== selectedTargetVersion.versionId
      ? buildAnnualResultVersionComparisonItems(selectedBaselineVersion, selectedTargetVersion)
      : [];
  const versionOptions = buildVersionOptions(resultVersions);

  return {
    currentUnitId,
    currentTaxYear,
    currentUnit,
    results,
    resultVersions,
    exportPreviewRows,
    statuses,
    loading,
    versionLoading,
    switchingScheme,
    errorMessage,
    exportFeedbackMessage,
    versionErrorMessage,
    selectedResult,
    selectedSchemeResult,
    selectedExplanation,
    selectedWithholdingExplanation,
    selectedRuleSourceExplanation,
    selectedExportPreviewRow,
    selectedBaselineVersionId,
    selectedTargetVersionId,
    selectedExportTemplateId,
    selectedExportColumnKeys,
    summary,
    exportSelectionSummary,
    selectedBaselineVersion,
    selectedTargetVersion,
    versionComparisonItems,
    versionOptions,
    loadResults,
    switchSelectedScheme,
    setSelectedEmployeeId,
    setSelectedBaselineVersionId,
    setSelectedTargetVersionId,
    setSelectedExportTemplateId,
    setSelectedExportColumnKeys,
    setExportFeedbackMessage,
    toggleExportColumn,
    applyExportTemplate,
    downloadExportPreview,
    downloadExportWorkbook,
  };
};

export type AnnualResultsPageData = ReturnType<typeof useAnnualResultsPage>;
