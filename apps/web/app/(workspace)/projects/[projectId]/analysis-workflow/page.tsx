import { AnalysisWorkflow } from "@/components/analysis-workflow";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { getProjectDatasetCatalog } from "@/lib/dataset-catalog";

export const dynamic = "force-dynamic";

export default async function AnalysisWorkflowPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await api.projects.get(projectId);
  const datasets = await getProjectDatasetCatalog(project);

  return (
    <>
      <PageHeader
        eyebrow="Guided analysis"
        title="Analysis Workflow"
        description="Move from a profiled dataset to a defensible statistical method in one transparent, guided workspace."
      />
      <AnalysisWorkflow projectId={projectId} datasets={datasets} />
    </>
  );
}
