import { Columns3, FileSpreadsheet, Rows3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ActiveProjectTracker } from "@/components/active-project-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ datasetId: string }>;
}) {
  const { datasetId } = await params;
  let dataset;
  try {
    dataset = await api.datasets.get(datasetId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const version = dataset.latest_version;

  return (
    <>
      <ActiveProjectTracker projectId={dataset.project_id} />
      <PageHeader
        eyebrow="Dataset"
        title={dataset.name}
        description={dataset.description || "No dataset description has been added."}
        action={<Badge>{dataset.source_format.toUpperCase()}</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-600">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <p className="font-bold text-ink">Latest dataset version</p>
              <p className="text-sm text-slate-500">
                {version ? `Version ${version.version_number}` : "No version available"}
              </p>
            </div>
          </div>
          {version ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Metric icon={Rows3} label="Rows" value={version.row_count ?? "—"} />
                <Metric icon={Columns3} label="Columns" value={version.column_count ?? "—"} />
              </div>
              <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <Detail label="Status" value={version.status} />
                <Detail label="Original file" value={version.original_filename} />
                <Detail label="Created" value={formatDate(version.created_at)} />
                <Detail label="Version ID" value={version.id} mono />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/dataset-versions/${version.id}/variables`}>View variables</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/dataset-versions/${version.id}/preview`}>Preview data</Link>
                </Button>
              </div>
            </>
          ) : null}
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Profile snapshot
          </p>
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
            {JSON.stringify(version?.profile_summary ?? {}, null, 2)}
          </pre>
        </Card>
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Rows3;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-4">
      <Icon className="size-5 text-brand-600" />
      <div>
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p className="text-xl font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-1 sm:flex-row">
      <span className="font-medium text-slate-500">{label}</span>
      <span className={mono ? "break-all font-mono text-xs text-slate-600" : "text-ink"}>
        {value}
      </span>
    </div>
  );
}
