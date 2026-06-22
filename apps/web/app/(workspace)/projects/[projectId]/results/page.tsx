import { notFound } from "next/navigation";

import { AnalysisResultsDashboard } from "@/components/analysis-results-dashboard";
import { PageHeader } from "@/components/page-header";
import { ApiError, api } from "@/lib/api";
import { getProjectDatasetCatalog } from "@/lib/dataset-catalog";

export const dynamic = "force-dynamic";

export default async function AnalysisResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let project;
  try {
    project = await api.projects.get(projectId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const datasets = await getProjectDatasetCatalog(project);

  return (
    <>
      <PageHeader
        eyebrow="Doctoral research output"
        title="Analysis Results"
        description="Review the statistical evidence, visual diagnostics, plain-language interpretation, and dissertation-ready reporting generated from your selected analysis."
      />
      <AnalysisResultsDashboard project={project} datasets={datasets} />
    </>
  );
}
