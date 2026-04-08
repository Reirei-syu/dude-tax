import { useAppContext } from "../context/AppContextProvider";
import { AnnualResultsDetailSection } from "./annual-results/components/AnnualResultsDetailSection";
import { AnnualResultsExportSection } from "./annual-results/components/AnnualResultsExportSection";
import { AnnualResultsListSection } from "./annual-results/components/AnnualResultsListSection";
import { AnnualResultsOverviewSection } from "./annual-results/components/AnnualResultsOverviewSection";
import { useAnnualResultsPage } from "./annual-results/hooks/useAnnualResultsPage";

export const AnnualResultsPage = () => {
  const { context } = useAppContext();
  const data = useAnnualResultsPage(context);

  if (!data.currentUnitId || !data.currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>结果中心</h1>
          <p>请先在顶部选择单位和年份，再进入结果中心。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <AnnualResultsOverviewSection
        currentUnit={data.currentUnit}
        currentTaxYear={data.currentTaxYear}
        loading={data.loading}
        summary={data.summary}
        errorMessage={data.errorMessage}
        exportPreviewRows={data.exportPreviewRows}
        selectedExportColumnKeys={data.selectedExportColumnKeys}
        loadResults={data.loadResults}
        downloadExportPreview={data.downloadExportPreview}
        downloadExportWorkbook={data.downloadExportWorkbook}
      />
      <AnnualResultsListSection
        results={data.results}
        selectedResult={data.selectedResult}
        summary={data.summary}
        setSelectedEmployeeId={data.setSelectedEmployeeId}
      />
      <AnnualResultsDetailSection data={data} />
      <AnnualResultsExportSection
        exportPreviewRows={data.exportPreviewRows}
        exportSelectionSummary={data.exportSelectionSummary}
        exportFeedbackMessage={data.exportFeedbackMessage}
        selectedExportTemplateId={data.selectedExportTemplateId}
        selectedExportColumnKeys={data.selectedExportColumnKeys}
        setSelectedExportTemplateId={data.setSelectedExportTemplateId}
        setSelectedExportColumnKeys={data.setSelectedExportColumnKeys}
        setExportFeedbackMessage={data.setExportFeedbackMessage}
        toggleExportColumn={data.toggleExportColumn}
        applyExportTemplate={data.applyExportTemplate}
      />
    </section>
  );
};
