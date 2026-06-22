import { Database, FolderKanban, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await api.projects.list();
  const active = projects.items.filter((project) => project.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Research command center"
        title="Good morning, researcher."
        description="Keep your projects, datasets, and study-design decisions moving in one calm workspace."
        action={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              Create New Project
            </Link>
          </Button>
        }
      />

      <div className="mb-9 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total projects",
            value: projects.total,
            icon: FolderKanban,
            color: "bg-brand-50 text-brand-600",
          },
          {
            label: "Active studies",
            value: active,
            icon: Sparkles,
            color: "bg-violet-50 text-violet-600",
          },
          {
            label: "Workspace status",
            value: "Ready",
            icon: Database,
            color: "bg-teal-50 text-teal-600",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className={`grid size-11 place-items-center rounded-xl ${color}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-0.5 text-2xl font-bold text-ink">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">Recent projects</h2>
        <Link href="/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          View all
        </Link>
      </div>

      {projects.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.items.slice(0, 6).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your first project is waiting"
          description="Create a research workspace to begin organizing datasets and design decisions."
          action={
            <Button asChild>
              <Link href="/projects/new">Create New Project</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
