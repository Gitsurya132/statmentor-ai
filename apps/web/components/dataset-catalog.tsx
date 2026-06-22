"use client";

import { ArrowUpDown, Database, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import type { DatasetCatalogItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type SortOption = "newest" | "oldest" | "name" | "project";

export function DatasetCatalog({ datasets }: { datasets: DatasetCatalogItem[] }) {
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          datasets.map((dataset) => [
            dataset.project_id,
            { id: dataset.project_id, name: dataset.project_name },
          ]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name)),
    [datasets],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return datasets
      .filter(
        (dataset) =>
          (!query ||
            dataset.name.toLowerCase().includes(query) ||
            dataset.project_name.toLowerCase().includes(query)) &&
          (projectId === "all" || dataset.project_id === projectId),
      )
      .sort((left, right) => {
        if (sort === "oldest") {
          return Date.parse(left.created_at) - Date.parse(right.created_at);
        }
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "project") return left.project_name.localeCompare(right.project_name);
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
  }, [datasets, projectId, search, sort]);

  return (
    <div className="space-y-5">
      <Card className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_240px_200px]">
        <div>
          <Label htmlFor="dataset-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="dataset-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search datasets or projects"
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="project-filter">Project</Label>
          <Select
            id="project-filter"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="dataset-sort">Sort</Label>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Select
              id="dataset-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="pl-10"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Dataset name</option>
              <option value="project">Project name</option>
            </Select>
          </div>
        </div>
      </Card>

      <p className="text-sm text-slate-500">
        Showing {visible.length} of {datasets.length} datasets
      </p>

      {visible.length ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Dataset Name</th>
                  <th className="px-5 py-4">Project Name</th>
                  <th className="px-5 py-4">Version</th>
                  <th className="px-5 py-4">Rows</th>
                  <th className="px-5 py-4">Columns</th>
                  <th className="px-5 py-4">Created Date</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((dataset) => {
                  const version = dataset.latest_version;
                  return (
                    <tr key={dataset.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <Link
                          href={`/datasets/${dataset.id}`}
                          className="flex items-center gap-3 font-semibold text-ink hover:text-brand-700"
                        >
                          <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-600">
                            <Database className="size-4" />
                          </span>
                          {dataset.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/projects/${dataset.project_id}`}
                          className="text-slate-600 hover:text-brand-700"
                        >
                          {dataset.project_name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {version ? `v${version.version_number}` : "—"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{version?.row_count ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{version?.column_count ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(dataset.created_at)}</td>
                      <td className="px-5 py-4">
                        <Badge
                          className={
                            version?.status === "ready"
                              ? "bg-teal-50 text-teal-700"
                              : version?.status === "failed"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                          }
                        >
                          {version?.status ?? "No version"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-10 text-center">
          <p className="font-semibold text-ink">No matching datasets</p>
          <p className="mt-2 text-sm text-slate-500">
            Try a different search term or project filter.
          </p>
        </Card>
      )}
    </div>
  );
}
