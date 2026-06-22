"use client";

import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { DatasetDetail } from "@/lib/types";

export function DatasetUploadForm({ projectId }: { projectId: string }) {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DatasetDetail | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setProgress(20);
    setError("");
    setResult(null);
    try {
      setProgress(45);
      const uploaded = await api.datasets.upload(projectId, formData);
      setProgress(100);
      setResult(uploaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
      setProgress(0);
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-2xl border-teal-200 p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-600">
          <CheckCircle2 className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-ink">Dataset ready</h2>
        <p className="mt-2 text-slate-600">
          {result.name} was uploaded, parsed, and profiled successfully.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Rows" value={result.latest_version?.row_count ?? "—"} />
          <Metric label="Columns" value={result.latest_version?.column_count ?? "—"} />
          <Metric label="Version" value={result.latest_version?.version_number ?? "—"} />
        </div>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Latest version ID
          </p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">
            {result.latest_version?.id}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/datasets/${result.id}`}>View dataset</Link>
          </Button>
          {result.latest_version ? (
            <Button asChild variant="secondary">
              <Link href={`/dataset-versions/${result.latest_version.id}/variables`}>
                Review variables
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl p-6 sm:p-8">
      <form action={submit} className="space-y-6">
        <div>
          <Label htmlFor="file">CSV or Excel file</Label>
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
              <UploadCloud className="size-6" />
            </span>
            <span className="mt-4 text-sm font-bold text-ink">Choose a data file</span>
            <span className="mt-1 text-xs text-slate-500">CSV, XLSX, or XLS up to 25 MB</span>
            <Input
              id="file"
              name="file"
              type="file"
              required
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-5 h-auto max-w-sm bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700"
            />
          </label>
        </div>
        <div>
          <Label htmlFor="name">Dataset name</Label>
          <Input id="name" name="name" required placeholder="Study responses — Wave 1" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea name="description" id="description" placeholder="What does this dataset contain?" />
        </div>
        <div>
          <Label htmlFor="import_options">Import options</Label>
          <Textarea
            name="import_options"
            id="import_options"
            defaultValue='{"header_row":0,"encoding":"utf-8","delimiter":","}'
            className="font-mono text-xs"
          />
        </div>
        {pending || progress ? (
          <div>
            <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
              <span>{pending ? "Uploading and profiling…" : "Complete"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          Upload dataset
        </Button>
      </form>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
