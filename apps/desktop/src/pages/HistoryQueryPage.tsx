import { useAppContext } from "../context/AppContextProvider";
import { HistoryComparisonSection } from "./history-query/components/HistoryComparisonSection";
import { HistoryQueryFiltersSection } from "./history-query/components/HistoryQueryFiltersSection";
import { HistoryResultDetailSection } from "./history-query/components/HistoryResultDetailSection";
import { HistoryResultsSection } from "./history-query/components/HistoryResultsSection";
import { HistoryVersionsSection } from "./history-query/components/HistoryVersionsSection";
import { HistoryYearSummarySection } from "./history-query/components/HistoryYearSummarySection";
import { useHistoryQueryPage } from "./history-query/hooks/useHistoryQueryPage";

export const HistoryQueryPage = () => {
  const { context } = useAppContext();
  const data = useHistoryQueryPage(context);

  return (
    <section className="page-grid">
      <HistoryQueryFiltersSection
        filters={data.filters}
        years={data.years}
        employees={data.employees}
        summary={data.summary}
        loading={data.loading}
        errorMessage={data.errorMessage}
        updateFilter={data.updateFilter}
        downloadHistoryCsv={data.downloadHistoryCsv}
        downloadHistoryWorkbook={data.downloadHistoryWorkbook}
        results={data.results}
        units={context?.units ?? []}
      />
      <HistoryResultsSection
        results={data.results}
        selectedResultId={data.selectedResultId}
        setSelectedResultId={data.setSelectedResultId}
      />
      <HistoryYearSummarySection
        yearSummaries={data.yearSummaries}
        filters={data.filters}
        updateFilter={data.updateFilter}
      />
      <HistoryResultDetailSection
        selectedResult={data.selectedResult}
        selectedRuleSourceExplanation={data.selectedRuleSourceExplanation}
        selectedWithholdingExplanation={data.selectedWithholdingExplanation}
      />
      <HistoryVersionsSection
        selectedResult={data.selectedResult}
        versionHistory={data.versionHistory}
        versionHistoryLoading={data.versionHistoryLoading}
        versionHistoryErrorMessage={data.versionHistoryErrorMessage}
      />
      <HistoryComparisonSection
        selectedResult={data.selectedResult}
        comparisonResult={data.comparisonResult}
        comparisonLoading={data.comparisonLoading}
        comparisonErrorMessage={data.comparisonErrorMessage}
        comparisonItems={data.comparisonItems}
      />
    </section>
  );
};
