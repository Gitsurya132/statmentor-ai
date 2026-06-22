import { EmptyState } from "@/components/empty-state";
import { ActiveProjectTracker } from "@/components/active-project-tracker";
import { PageHeader } from "@/components/page-header";
import { VariablesTable } from "@/components/variables-table";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function VariablesPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  const [variables, version] = await Promise.all([
    api.datasets.variables(versionId),
    api.datasets.version(versionId),
  ]);

  return (
    <>
      <ActiveProjectTracker projectId={version.project_id} />
      <PageHeader
        eyebrow="Variable dictionary"
        title="Understand every column"
        description="Review inferred data types and measurement levels, then run role and scale classification."
      />
      {variables.length ? (
        <VariablesTable versionId={versionId} initialVariables={variables} />
      ) : (
        <EmptyState
          title="No variables found"
          description="This dataset version does not contain any variable metadata."
        />
      )}
    </>
  );
}
