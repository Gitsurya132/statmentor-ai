"use client";

import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LocalAnalysisEngine } from "@/lib/analysis";
import type {
  AnalysisResult,
  AssumptionResult,
  ChartSpec,
} from "@/lib/analysis";
import { api } from "@/lib/api";
import type { DatasetCatalogItem, Project } from "@/lib/types";
import {
  getAnalysisWorkflowState,
  getRecommendation,
} from "@/lib/workspace-state";
import { formatDate, titleCase } from "@/lib/utils";

const engine = new LocalAnalysisEngine();

export function AnalysisResultsDashboard({
  project,
  datasets,
}: {
  project: Project;
  datasets: DatasetCatalogItem[];
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dataset, setDataset] = useState<DatasetCatalogItem | null>(null);
  const [variables, setVariables] = useState<
    NonNullable<ReturnType<typeof getAnalysisWorkflowState>>["selected_variables"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let active = true;
    async function execute() {
      const state = getAnalysisWorkflowState(project.id);
      const recommendation = getRecommendation(project.id);
      if (!state?.selected_method_key || !state.selected_variables?.length) {
        setError("Select variables and a statistical test in the Analysis Workflow first.");
        setLoading(false);
        return;
      }
      const selectedDataset =
        datasets.find(
          (item) => item.latest_version?.id === state.dataset_version_id,
        ) ?? null;
      if (!selectedDataset) {
        setError("The dataset used for this analysis is no longer available.");
        setLoading(false);
        return;
      }
      try {
        const total = selectedDataset.latest_version?.row_count ?? 0;
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; offset < total; offset += 1000) {
          const preview = await api.datasets.preview(
            state.dataset_version_id,
            offset,
            Math.min(1000, total - offset),
          );
          rows.push(...preview.rows);
        }
        if (!active) return;
        const methodName =
          recommendation?.recommendations.find(
            (item) => item.method_key === state.selected_method_key,
          )?.method_name ?? titleCase(state.selected_method_key);
        const output = engine.run({
          methodKey: state.selected_method_key,
          rows,
          variables: state.selected_variables,
        });
        output.methodName = methodName;
        setDataset(selectedDataset);
        setVariables(state.selected_variables);
        setResult(output);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The analysis could not be calculated.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void execute();
    return () => {
      active = false;
    };
  }, [datasets, project.id]);

  if (loading) {
    return (
      <Card className="grid min-h-80 place-items-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-brand-600" />
          <p className="mt-3 font-semibold text-ink">Calculating verified results…</p>
          <p className="mt-1 text-sm text-slate-500">
            Loading dataset rows and applying the selected deterministic method.
          </p>
        </div>
      </Card>
    );
  }

  if (error || !result || !dataset) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-500" />
        <h2 className="mt-4 text-lg font-bold text-ink">Analysis output is not ready</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{error}</p>
        <Button asChild className="mt-5">
          <Link href={`/projects/${project.id}/analysis-workflow`}>
            Return to Analysis Workflow
          </Link>
        </Button>
      </Card>
    );
  }

  const independent = variables?.filter(
    (variable) => variable.role === "independent_variable",
  ) ?? [];
  const dependent = variables?.find(
    (variable) => variable.role === "dependent_variable",
  );
  const version = dataset.latest_version;
  const profile = version?.profile_summary ?? {};
  const columns = Array.isArray(profile.columns)
    ? (profile.columns as { data_type?: string }[])
    : [];
  const numericalCount = columns.filter((column) =>
    ["integer", "float"].includes(column.data_type ?? ""),
  ).length;
  const missingCount =
    typeof profile.missing_cell_count === "number"
      ? profile.missing_cell_count
      : 0;
  const datasetType = variables?.some((variable) =>
    /(date|time|month|year|quarter|week|day)/i.test(variable.source_name),
  )
    ? "Longitudinal / Time-Oriented"
    : "Cross-Sectional";

  const researchSummary = [
    ["Study Title", project.title],
    ["Dataset", dataset.name],
    ["Dataset Type", datasetType],
    ["Sample Size", result.sampleSize],
    [
      "Independent Variable(s)",
      independent.map((variable) => variable.display_name).join(", ") ||
        "Not applicable",
    ],
    ["Dependent Variable", dependent?.display_name ?? "Not applicable"],
    ["Selected Statistical Test", result.methodName],
    ["Analysis Date", formatDate(result.generatedAt)],
  ];

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading icon={FileText} title="Research Summary" />
        <Card className="grid gap-px overflow-hidden bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          {researchSummary.map(([label, value]) => (
            <Metric key={String(label)} label={String(label)} value={String(value)} />
          ))}
        </Card>
      </section>

      <section>
        <SectionHeading icon={BarChart3} title="Dataset Overview" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="Total Rows" value={version?.row_count ?? "—"} />
          <SummaryCard label="Total Variables" value={version?.column_count ?? "—"} />
          <SummaryCard label="Numerical" value={numericalCount} />
          <SummaryCard label="Categorical" value={Math.max(0, columns.length - numericalCount)} />
          <SummaryCard label="Missing Values" value={missingCount} />
          <SummaryCard label="Dataset Type" value={datasetType} />
        </div>
      </section>

      <section>
        <SectionHeading icon={BarChart3} title="Automatic Data Visualization" />
        <Card className="p-5 sm:p-6">
          {result.chart ? (
            <ResearchChart spec={result.chart} chartRef={chartRef} />
          ) : (
            <p className="text-sm text-slate-500">
              No chart is applicable to this analysis.
            </p>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading icon={CheckCircle2} title="Assumption Validation" />
        <div className="grid gap-3 md:grid-cols-2">
          {result.assumptions.map((assumption) => (
            <AssumptionCard key={assumption.name} assumption={assumption} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading icon={Sparkles} title="Statistical Results" />
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Statistic</th>
                <th className="px-5 py-4">Value</th>
                <th className="px-5 py-4">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.metrics.map((metric) => (
                <tr key={metric.label}>
                  <td className="px-5 py-4 font-semibold text-ink">{metric.label}</td>
                  <td className="px-5 py-4 font-mono text-brand-700">{metric.value}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {metric.interpretation ?? "Calculated from complete observations."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
        <Card className="p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Effect Size
          </p>
          <h3 className="mt-3 text-lg font-bold text-ink">{result.effectSize.name}</h3>
          <p className="mt-3 text-4xl font-bold text-brand-700">
            {result.effectSize.value}
          </p>
          <Badge className="mt-4 bg-violet-50 text-violet-700">
            {result.effectSize.magnitude} effect
          </Badge>
        </Card>
        <Card className="border-teal-100 bg-teal-50/50 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Plain-Language Interpretation
          </p>
          <p className="mt-4 text-base leading-8 text-slate-700">
            {result.interpretation}
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading icon={FileText} title="APA-Style Output" />
        <Card className="p-6 sm:p-8">
          <p className="font-serif text-lg leading-9 text-slate-700">{result.apa}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-5"
            onClick={() => void navigator.clipboard.writeText(result.apa)}
          >
            <Clipboard className="size-4" />
            Copy APA Text
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeading icon={Lightbulb} title="Research Advisor Conclusions" />
        <div className="grid gap-5 lg:grid-cols-2">
          <AdvisorList title="Key Findings" items={result.findings} />
          <AdvisorList title="Recommended Next Steps" items={result.nextSteps} />
        </div>
      </section>

      <section>
        <SectionHeading icon={Download} title="Export Options" />
        <Card className="flex flex-wrap gap-3 p-5">
          <Button onClick={() => window.print()}>
            <Printer className="size-4" />
            Export Results PDF
          </Button>
          <Button variant="secondary" onClick={() => downloadText(`${project.title}-APA-report.txt`, result.apa)}>
            <FileText className="size-4" />
            Export APA Report
          </Button>
          <Button variant="secondary" onClick={() => downloadWord(project.title, result)}>
            <FileText className="size-4" />
            Export Word Document
          </Button>
          <Button variant="secondary" onClick={() => downloadChart(chartRef.current, result.chart?.title ?? "chart")}>
            <BarChart3 className="size-4" />
            Export Chart
          </Button>
        </Card>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Engine: {result.engine}. Calculations use complete rows returned by the existing
        dataset preview API. Assumption indicators are screening diagnostics and should be
        reviewed alongside the research design.
      </p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-5 text-brand-600" />
      <h2 className="text-xl font-bold text-ink">{title}</h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
    </Card>
  );
}

function AssumptionCard({ assumption }: { assumption: AssumptionResult }) {
  const config = {
    passed: { icon: Check, label: "Passed", classes: "bg-teal-50 text-teal-700" },
    warning: {
      icon: AlertTriangle,
      label: "Warning",
      classes: "bg-amber-50 text-amber-700",
    },
    failed: { icon: X, label: "Failed", classes: "bg-rose-50 text-rose-700" },
  }[assumption.status];
  const Icon = config.icon;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-ink">{assumption.name}</h3>
        <Badge className={config.classes}>
          <Icon className="mr-1 size-3.5" />
          {config.label}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{assumption.explanation}</p>
    </Card>
  );
}

function AdvisorList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-6">
      <h3 className="font-bold text-ink">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-600" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ResearchChart({
  spec,
  chartRef,
}: {
  spec: ChartSpec;
  chartRef: React.RefObject<SVGSVGElement | null>;
}) {
  const width = 760;
  const height = 360;
  const padding = 52;
  if (spec.type === "scatter" && spec.points?.length) {
    const xValues = spec.points.map((point) => point.x);
    const yValues = spec.points.map((point) => point.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xScale = (value: number) =>
      padding + ((value - xMin) / (xMax - xMin || 1)) * (width - padding * 2);
    const yScale = (value: number) =>
      height - padding - ((value - yMin) / (yMax - yMin || 1)) * (height - padding * 2);
    return (
      <ChartFrame spec={spec}>
        <svg ref={chartRef} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
          <Axes width={width} height={height} padding={padding} />
          {spec.points.slice(0, 800).map((point, index) => (
            <circle key={index} cx={xScale(point.x)} cy={yScale(point.y)} r="4" fill="#0d9488" opacity=".65" />
          ))}
          {spec.trendline ? (
            <line x1={xScale(spec.trendline.x1)} y1={yScale(spec.trendline.y1)} x2={xScale(spec.trendline.x2)} y2={yScale(spec.trendline.y2)} stroke="#4f46e5" strokeWidth="3" />
          ) : null}
        </svg>
      </ChartFrame>
    );
  }
  const bars = spec.bars ?? [];
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const available = width - padding * 2;
  const barWidth = Math.max(16, available / Math.max(bars.length, 1) - 12);
  return (
    <ChartFrame spec={spec}>
      <svg ref={chartRef} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        <Axes width={width} height={height} padding={padding} />
        {bars.slice(0, 20).map((bar, index) => {
          const x = padding + index * (available / Math.max(bars.length, 1)) + 6;
          const barHeight = (bar.value / max) * (height - padding * 2);
          return (
            <g key={bar.label}>
              <rect x={x} y={height - padding - barHeight} width={barWidth} height={barHeight} rx="5" fill="#2563eb" opacity=".82" />
              <text x={x + barWidth / 2} y={height - padding + 17} textAnchor="middle" fontSize="10" fill="#64748b">{bar.label.slice(0, 12)}</text>
              <text x={x + barWidth / 2} y={height - padding - barHeight - 7} textAnchor="middle" fontSize="10" fill="#334155">{bar.value.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

function ChartFrame({ spec, children }: { spec: ChartSpec; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-ink">{spec.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{spec.xLabel} → {spec.yLabel}</p>
      <div className="mt-5 overflow-hidden rounded-xl bg-slate-50 p-3">{children}</div>
    </div>
  );
}

function Axes({ width, height, padding }: { width: number; height: number; padding: number }) {
  return (
    <>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" />
    </>
  );
}

function downloadText(filename: string, content: string) {
  downloadBlob(filename, new Blob([content], { type: "text/plain;charset=utf-8" }));
}

function downloadWord(title: string, result: AnalysisResult) {
  const html = `<html><body><h1>${escapeHtml(title)}</h1><h2>${escapeHtml(result.methodName)}</h2><p>${escapeHtml(result.apa)}</p><h3>Interpretation</h3><p>${escapeHtml(result.interpretation)}</p></body></html>`;
  downloadBlob(
    `${slug(title)}-analysis.doc`,
    new Blob([html], { type: "application/msword" }),
  );
}

function downloadChart(svg: SVGSVGElement | null, title: string) {
  if (!svg) return;
  const source = new XMLSerializer().serializeToString(svg);
  downloadBlob(`${slug(title)}.svg`, new Blob([source], { type: "image/svg+xml" }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}
