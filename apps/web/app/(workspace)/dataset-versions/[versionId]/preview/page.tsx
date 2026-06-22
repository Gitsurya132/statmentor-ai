import { PageHeader } from "@/components/page-header";
import { ActiveProjectTracker } from "@/components/active-project-tracker";
import { DatasetPreviewTable } from "@/components/dataset-preview-table";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DatasetPreviewPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  const version = await api.datasets.version(versionId);

  return (
    <>
      <ActiveProjectTracker projectId={version.project_id} />
      <PageHeader
        eyebrow="Data preview"
        title="A quick look at your dataset"
        description="Browse the dataset in manageable pages. Preview data is read-only."
      />
      <DatasetPreviewTable versionId={versionId} />
    </>
  );
}
