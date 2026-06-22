import { AnalysisWorkflow } from "@/components/analysis-workflow";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getGlobalDatasetCatalog } from "@/lib/dataset-catalog";

export const dynamic = "force-dynamic";

export default async function GlobalAnalysisWorkflowPage() {
  const datasets = await getGlobalDatasetCatalog();

  return (
    <>
      <PageHeader
        eyebrow="Global guided analysis"
        title="Analysis Workflow"
        description="Choose any ready dataset across your projects, classify its variables, and receive a transparent statistical recommendation."
      />
      {datasets.length ? (
        <AnalysisWorkflow datasets={datasets} />
      ) : (
        <EmptyState
          title="No datasets available"
          description="Upload a dataset inside a project before starting an analysis workflow."
        />
      )}
    </>
  );
}
