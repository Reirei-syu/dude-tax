import {
  ANNUAL_TAX_EXPORT_COLUMNS,
  ANNUAL_TAX_EXPORT_TEMPLATES,
  type AnnualTaxExportColumnDefinition,
  type AnnualTaxExportColumnGroup,
  type AnnualTaxExportColumnKey,
  type AnnualTaxExportTemplate,
  type AnnualTaxExportTemplateId,
} from "./annual-tax-export";

export type AnnualTaxExportGroupSummary = {
  group: AnnualTaxExportColumnGroup;
  count: number;
  labels: string[];
};

export type AnnualTaxExportTemplateSummary = {
  id: AnnualTaxExportTemplateId;
  label: string;
  description: string;
  columnCount: number;
  groupCount: number;
  groups: AnnualTaxExportColumnGroup[];
  isActive: boolean;
};

export type AnnualTaxExportSelectionSummary = {
  selectedColumnCount: number;
  selectedGroupCount: number;
  matchedTemplateId: AnnualTaxExportTemplateId | null;
  matchedTemplateLabel: string | null;
  isCustomSelection: boolean;
  groups: AnnualTaxExportGroupSummary[];
  templates: AnnualTaxExportTemplateSummary[];
};

const isSameKeySet = (left: AnnualTaxExportColumnKey[], right: AnnualTaxExportColumnKey[]) =>
  left.length === right.length && left.every((key) => right.includes(key));

const buildGroupSummaries = (
  selectedColumns: AnnualTaxExportColumnDefinition[],
): AnnualTaxExportGroupSummary[] =>
  Array.from(
    selectedColumns.reduce((groupMap, column) => {
      const existing = groupMap.get(column.group) ?? [];
      existing.push(column.label);
      groupMap.set(column.group, existing);
      return groupMap;
    }, new Map<AnnualTaxExportColumnGroup, string[]>()),
  ).map(([group, labels]) => ({
    group,
    count: labels.length,
    labels,
  }));

const buildTemplateSummary = (
  template: AnnualTaxExportTemplate,
  activeTemplateId: AnnualTaxExportTemplateId | null,
): AnnualTaxExportTemplateSummary => {
  const templateColumns = ANNUAL_TAX_EXPORT_COLUMNS.filter((column) =>
    template.columnKeys.includes(column.key),
  );
  const groupSummaries = buildGroupSummaries(templateColumns);

  return {
    id: template.id,
    label: template.label,
    description: template.description,
    columnCount: template.columnKeys.length,
    groupCount: groupSummaries.length,
    groups: groupSummaries.map((groupSummary) => groupSummary.group),
    isActive: template.id === activeTemplateId,
  };
};

export const buildAnnualTaxExportSelectionSummary = (
  selectedColumnKeys: AnnualTaxExportColumnKey[],
): AnnualTaxExportSelectionSummary => {
  const selectedColumns = ANNUAL_TAX_EXPORT_COLUMNS.filter((column) =>
    selectedColumnKeys.includes(column.key),
  );
  const matchedTemplate = ANNUAL_TAX_EXPORT_TEMPLATES.find((template) =>
    isSameKeySet(template.columnKeys, selectedColumnKeys),
  );

  return {
    selectedColumnCount: selectedColumns.length,
    selectedGroupCount: buildGroupSummaries(selectedColumns).length,
    matchedTemplateId: matchedTemplate?.id ?? null,
    matchedTemplateLabel: matchedTemplate?.label ?? null,
    isCustomSelection: !matchedTemplate,
    groups: buildGroupSummaries(selectedColumns),
    templates: ANNUAL_TAX_EXPORT_TEMPLATES.map((template) =>
      buildTemplateSummary(template, matchedTemplate?.id ?? null),
    ),
  };
};
