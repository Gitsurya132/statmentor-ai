import { Info, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  upload: "upload a dataset",
  "view-datasets": "view datasets",
  "analysis-workflow": "open the Analysis Workflow",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; action?: string }>;
}) {
  const { notice, action } = await searchParams;
  const projects = await api.projects.list();
  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Your research portfolio"
        description="Each project keeps its datasets, design decisions, and future analyses together."
        action={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        }
      />
      {notice === "select-project" ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-brand-900"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <p>
            Select a project first to{" "}
            <span className="font-semibold">
              {actionLabels[action ?? ""] ?? "continue"}
            </span>
            . Your selection will be remembered for future navigation.
          </p>
        </div>
      ) : null}
      {projects.items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          description="Create a project to start building your doctoral research workspace."
          action={
            <Button asChild>
              <Link href="/projects/new">Create a project</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
