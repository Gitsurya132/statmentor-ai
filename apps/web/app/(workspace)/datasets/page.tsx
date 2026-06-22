import { DatasetCatalog } from "@/components/dataset-catalog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getGlobalDatasetCatalog } from "@/lib/dataset-catalog";

export const dynamic = "force-dynamic";

export default async function GlobalDatasetsPage() {
  const datasets = await getGlobalDatasetCatalog();

  return (
    <>
      <PageHeader
        eyebrow="Global data library"
        title="All datasets"
        description="Browse datasets across every project, inspect their latest versions, and quickly find the data you need."
      />
      {datasets.length ? (
        <DatasetCatalog datasets={datasets} />
      ) : (
        <EmptyState
          title="No datasets uploaded"
          description="Create or open a project, then upload a CSV or Excel file."
        />
      )}
    </>
  );
}
