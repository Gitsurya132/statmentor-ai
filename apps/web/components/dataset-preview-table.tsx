"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { DatasetPreview } from "@/lib/types";

const PAGE_SIZES = [10, 20, 50, 100] as const;

export function DatasetPreviewTable({ versionId }: { versionId: string }) {
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const offset = (page - 1) * pageSize;

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setLoading(true);
      setError("");
      try {
        const response = await api.datasets.preview(versionId, offset, pageSize);
        if (active) setPreview(response);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load the preview.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [offset, pageSize, versionId]);

  const totalRows = preview?.total_rows ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = totalRows === 0 ? 0 : offset + 1;
  const endRow = Math.min(offset + (preview?.rows.length ?? 0), totalRows);
  const isFirstPage = page === 1;
  const isLastPage = endRow >= totalRows;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <label htmlFor="rows-per-page" className="text-sm font-semibold text-ink">
            Rows per page:
          </label>
          <Select
            id="rows-per-page"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-9 w-24"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Showing {startRow}–{endRow} of {totalRows} rows
        </p>
      </div>

      {error ? (
        <div className="m-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="relative min-h-48 overflow-x-auto">
        {loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/80">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="size-4 animate-spin text-brand-600" />
              Loading rows…
            </div>
          </div>
        ) : null}

        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {(preview?.columns ?? []).map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(preview?.rows ?? []).map((row, index) => (
              <tr key={`${offset}-${index}`} className="hover:bg-slate-50/50">
                {(preview?.columns ?? []).map((column) => (
                  <td key={column} className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {row[column] === null || row[column] === undefined
                      ? "—"
                      : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row">
        <Button
          variant="secondary"
          size="sm"
          disabled={isFirstPage || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <p className="text-sm font-semibold text-slate-600">
          Page {page} of {totalPages}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={isLastPage || loading || totalRows === 0}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
