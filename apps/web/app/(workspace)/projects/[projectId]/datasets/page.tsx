import { FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDatasetsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const datasets = await api.datasets.list(projectId);

  return (
    <>
      <PageHeader
        eyebrow="Project datasets"
        title="Data library"
        description="Review the tabular sources attached to this research project."
        action={
          <Button asChild>
            <Link href={`/projects/${projectId}/datasets/upload`}>
              <Plus className="size-4" />
              Upload dataset
            </Link>
          </Button>
        }
      />
      {datasets.items.length ? (
        <div className="grid gap-4">
          {datasets.items.map((dataset) => (
            <Link key={dataset.id} href={`/datasets/${dataset.id}`}>
              <Card className="flex flex-col justify-between gap-5 p-5 transition hover:border-brand-200 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                    <FileSpreadsheet className="size-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-ink">{dataset.name}</h2>
                      <Badge>{dataset.source_format.toUpperCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {dataset.description || "No description provided."}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-400">
                  Added {formatDate(dataset.created_at)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No datasets uploaded"
          description="Upload a CSV or Excel file to begin exploring variables and metadata."
          action={
            <Button asChild>
              <Link href={`/projects/${projectId}/datasets/upload`}>Upload dataset</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
