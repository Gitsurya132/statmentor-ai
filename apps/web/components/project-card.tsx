import { ArrowUpRight, CalendarDays, FolderKanban } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Project } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="h-full p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-lg sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <FolderKanban className="size-4" />
          </span>
          <ArrowUpRight className="size-4 text-slate-300 transition group-hover:text-brand-600" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge
            className={
              project.status === "active"
                ? "bg-teal-50 text-teal-600"
                : "bg-slate-100 text-slate-600"
            }
          >
            {project.status}
          </Badge>
        </div>
        <h2 className="mt-2.5 line-clamp-1 text-base font-bold text-ink">
          {project.title}
        </h2>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
          {project.description || "No description added yet."}
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-medium text-slate-400">
          <CalendarDays className="size-3" />
          Created {formatDate(project.created_at)}
        </div>
      </Card>
    </Link>
  );
}
