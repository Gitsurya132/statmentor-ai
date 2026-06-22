import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ProjectWorkspaceDashboard } from "@/components/project-workspace-dashboard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { getProjectDatasetCatalog } from "@/lib/dataset-catalog";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
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
  const latestDataset =
    [...datasets].sort(
      (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
    )[0] ?? null;
  const versionId = latestDataset?.latest_version?.id;
  const variables = versionId ? await api.datasets.variables(versionId) : [];

  const discipline =
    typeof project.research_context.discipline === "string"
      ? project.research_context.discipline
      : "Not specified";

  return (
    <>
      <PageHeader
        eyebrow="Project workspace"
        title={project.title}
        description={project.description || "No project description has been added."}
        action={<Badge className="bg-teal-50 text-teal-600">{project.status}</Badge>}
      />

      <Card className="mb-8 grid gap-5 p-5 sm:grid-cols-3">
        <ProjectDetail label="Discipline" value={discipline} />
        <ProjectDetail label="Created" value={formatDate(project.created_at)} />
        <ProjectDetail label="Project ID" value={project.id} mono />
      </Card>

      <ProjectWorkspaceDashboard
        project={project}
        datasets={datasets}
        variables={variables}
      />
    </>
  );
}

function ProjectDetail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-2 font-semibold text-ink ${
          mono ? "truncate font-mono text-xs text-slate-600" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
