"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  FileSearch,
  FlaskConical,
  Info,
  Lightbulb,
  Sparkles,
  Upload,
  Variable,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  DatasetCatalogItem,
  Project,
  TestRecommendationResponse,
  Variable as DatasetVariable,
  VariableRole,
} from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";
import {
  type AnalysisWorkflowState,
  getAnalysisWorkflowState,
  getRecommendation,
  WORKSPACE_STATE_EVENT,
} from "@/lib/workspace-state";

type ProgressStatus = "Completed" | "In Progress" | "Not Started";

export function ProjectWorkspaceDashboard({
  project,
  datasets,
  variables,
}: {
  project: Project;
  datasets: DatasetCatalogItem[];
  variables: DatasetVariable[];
}) {
  const [recommendation, setRecommendation] =
    useState<TestRecommendationResponse | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisWorkflowState | null>(null);

  useEffect(() => {
    const sync = () => {
      setRecommendation(getRecommendation(project.id));
      setAnalysisState(getAnalysisWorkflowState(project.id));
    };
    sync();
    window.addEventListener(WORKSPACE_STATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WORKSPACE_STATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [project.id]);

  const latestDataset = useMemo(
    () =>
      [...datasets].sort(
        (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
      )[0] ?? null,
    [datasets],
  );
  const latestVersion = latestDataset?.latest_version ?? null;
  const variableSummary = summarizeVariables(variables);
  const roles = summarizeRoles(variables);
  const variablesReviewed =
    variables.length > 0 &&
    variables.some(
      (variable) =>
        Boolean(variable.profile.classification) &&
        Boolean(variable.profile.scale_detection),
    );
  const rolesConfirmed = roles.independent > 0 && roles.dependent > 0;
  const matchingRecommendation =
    recommendation?.dataset_version_id === latestVersion?.id ? recommendation : null;
  const matchingAnalysis =
    analysisState?.dataset_version_id === latestVersion?.id ? analysisState : null;
  const selectedMethod = matchingRecommendation?.recommendations.find(
    (method) => method.method_key === matchingAnalysis?.selected_method_key,
  );
  const missingValues = datasets.reduce(
    (total, dataset) =>
      total + numericValue(dataset.latest_version?.profile_summary.missing_cell_count),
    0,
  );

  const completed = [
    true,
    datasets.length > 0,
    variables.length > 0,
    rolesConfirmed,
    Boolean(matchingRecommendation),
    Boolean(matchingAnalysis?.selected_method_key),
    Boolean(matchingAnalysis?.analysis_run),
    Boolean(matchingAnalysis?.results_interpreted),
    Boolean(matchingAnalysis?.apa_report_generated),
  ];
  const progressLabels = [
    "Project Created",
    "Dataset Uploaded",
    "Variables Profiled",
    "Variable Roles Confirmed",
    "Statistical Recommendation Generated",
    "Test Selected",
    "Analysis Run",
    "Results Interpreted",
    "APA Report Generated",
  ];
  const firstIncomplete = completed.findIndex((item) => !item);
  const progress = progressLabels.map((label, index) => ({
    label,
    status: completed[index]
      ? ("Completed" as const)
      : index === firstIncomplete
        ? ("In Progress" as const)
        : ("Not Started" as const),
  }));

  const advisor = getAdvisorAction({
    projectId: project.id,
    latestVersionId: latestVersion?.id,
    hasDataset: datasets.length > 0,
    variablesReviewed,
    recommendation: matchingRecommendation,
    analysisState: matchingAnalysis,
  });

  const alerts = getAlerts({
    hasDataset: datasets.length > 0,
    hasVariables: variables.length > 0,
    variablesReviewed,
    roles,
    missingValues,
    recommendation: matchingRecommendation,
    analysisState: matchingAnalysis,
  });

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={CheckCircle2} title="Research Progress" />
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {progress.map((item) => (
              <ProgressItem key={item.label} {...item} />
            ))}
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle icon={Lightbulb} title="Research Advisor" />
        <Card className="overflow-hidden border-brand-100 bg-gradient-to-br from-brand-50 via-white to-teal-50 p-6 sm:p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex max-w-3xl gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                <Sparkles className="size-6" />
              </span>
              <div>
                <Badge className="bg-white text-brand-700">Recommended next step</Badge>
                <h2 className="mt-3 text-xl font-bold text-ink">{advisor.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{advisor.message}</p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href={advisor.href}>
                {advisor.button}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle icon={BarChart3} title="Project Analysis Snapshot" />
        <Card className="grid gap-px overflow-hidden bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotMetric label="Datasets" value={datasets.length} />
          <SnapshotMetric
            label="Total rows"
            value={
              datasets.length
                ? datasets.reduce(
                    (total, dataset) =>
                      total + (dataset.latest_version?.row_count ?? 0),
                    0,
                  )
                : "Not available yet"
            }
          />
          <SnapshotMetric
            label="Total variables"
            value={
              datasets.length
                ? datasets.reduce(
                    (total, dataset) =>
                      total + (dataset.latest_version?.column_count ?? 0),
                    0,
                  )
                : "Not available yet"
            }
          />
          <SnapshotMetric label="Numerical variables" value={availableValue(variableSummary.numerical, variables.length)} />
          <SnapshotMetric label="Categorical variables" value={availableValue(variableSummary.categorical, variables.length)} />
          <SnapshotMetric label="Missing values detected" value={datasets.length ? missingValues : "Not available yet"} />
          <SnapshotMetric label="Current dataset type" value={latestDataset?.source_format.toUpperCase() ?? "Not available yet"} />
          <SnapshotMetric label="Current recommendation" value={matchingRecommendation?.recommendations[0]?.method_name ?? "Not available yet"} />
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <DatasetSummaryCard projectId={project.id} dataset={latestDataset} />
        <VariableSummaryCard
          versionId={latestVersion?.id}
          summary={variableSummary}
          hasVariables={variables.length > 0}
        />
        <RecommendationSummaryCard
          projectId={project.id}
          recommendation={matchingRecommendation}
          selectedMethod={selectedMethod?.method_name}
          variables={variables}
        />
      </div>

      <section>
        <SectionTitle icon={AlertCircle} title="Research Alerts" />
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <div
              key={alert}
              className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {alert}
            </div>
          ))}
          {!alerts.length ? (
            <div className="flex gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <CheckCircle2 className="size-4 shrink-0" />
              No immediate research alerts. Continue reviewing your analysis outputs.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Check; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-5 text-brand-600" />
      <h2 className="text-xl font-bold text-ink">{title}</h2>
    </div>
  );
}

function ProgressItem({ label, status }: { label: string; status: ProgressStatus }) {
  const config = {
    Completed: {
      icon: Check,
      classes: "bg-teal-50 text-teal-700",
    },
    "In Progress": {
      icon: Clock3,
      classes: "bg-brand-50 text-brand-700",
    },
    "Not Started": {
      icon: Circle,
      classes: "bg-slate-50 text-slate-500",
    },
  }[status];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${config.classes}`}>
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{status}</p>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function DatasetSummaryCard({
  projectId,
  dataset,
}: {
  projectId: string;
  dataset: DatasetCatalogItem | null;
}) {
  const version = dataset?.latest_version;
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-600"><Database className="size-5" /></span>
        <h3 className="font-bold text-ink">Dataset Summary</h3>
      </div>
      {dataset ? (
        <>
          <h4 className="mt-5 font-semibold text-ink">{dataset.name}</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <SummaryRow label="File type" value={dataset.source_format.toUpperCase()} />
            <SummaryRow label="Rows" value={version?.row_count ?? "Not available yet"} />
            <SummaryRow label="Columns" value={version?.column_count ?? "Not available yet"} />
            <SummaryRow label="Upload date" value={formatDate(dataset.created_at)} />
            <SummaryRow label="Status" value={titleCase(version?.status ?? "not available")} />
          </dl>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button asChild size="sm"><Link href={`/datasets/${dataset.id}`}><FileSearch className="size-4" />View Dataset</Link></Button>
            <Button asChild size="sm" variant="secondary"><Link href={`/projects/${projectId}/datasets/upload`}><Upload className="size-4" />Upload New</Link></Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-5 text-sm leading-6 text-slate-500">No dataset has been uploaded to this project.</p>
          <Button asChild size="sm" className="mt-auto self-start"><Link href={`/projects/${projectId}/datasets/upload`}>Upload Dataset</Link></Button>
        </>
      )}
    </Card>
  );
}

function VariableSummaryCard({
  versionId,
  summary,
  hasVariables,
}: {
  versionId?: string;
  summary: ReturnType<typeof summarizeVariables>;
  hasVariables: boolean;
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Variable className="size-5" /></span>
        <h3 className="font-bold text-ink">Variable Summary</h3>
      </div>
      {hasVariables ? (
        <>
          <dl className="mt-5 space-y-2 text-sm">
            <SummaryRow label="Numerical" value={summary.numerical} />
            <SummaryRow label="Categorical" value={summary.categorical} />
            <SummaryRow label="Time" value={summary.time} />
            <SummaryRow label="Count" value={summary.count} />
            <SummaryRow label="Needing review" value={summary.needingReview} />
          </dl>
          {versionId ? (
            <Button asChild size="sm" variant="secondary" className="mt-auto self-start">
              <Link href={`/dataset-versions/${versionId}/variables`}>Review Variable Dictionary</Link>
            </Button>
          ) : null}
        </>
      ) : (
        <p className="mt-5 text-sm leading-6 text-slate-500">Variable metadata is not available yet.</p>
      )}
    </Card>
  );
}

function RecommendationSummaryCard({
  projectId,
  recommendation,
  selectedMethod,
  variables,
}: {
  projectId: string;
  recommendation: TestRecommendationResponse | null;
  selectedMethod?: string;
  variables: DatasetVariable[];
}) {
  const top = recommendation?.recommendations[0];
  const usedVariables = variables
    .filter((variable) => ["independent_variable", "dependent_variable"].includes(variableRole(variable)))
    .map((variable) => variable.display_name);
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><FlaskConical className="size-5" /></span>
        <h3 className="font-bold text-ink">Recommendation Summary</h3>
      </div>
      {top ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge className="bg-violet-50 text-violet-700">{selectedMethod ? "Selected" : "Top recommendation"}</Badge>
            <span className="text-xs font-bold text-teal-700">{Math.round(top.confidence_score * 100)}% fit</span>
          </div>
          <h4 className="mt-3 font-bold text-ink">{selectedMethod ?? top.method_name}</h4>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{top.why_recommended}</p>
          <p className="mt-3 text-xs text-slate-500">Variables: {usedVariables.join(", ") || "Not available yet"}</p>
        </>
      ) : (
        <p className="mt-5 text-sm leading-6 text-slate-500">No recommendation generated yet.</p>
      )}
      <Button asChild size="sm" variant="secondary" className="mt-auto self-start">
        <Link href={`/projects/${projectId}/analysis-workflow`}>Open Analysis Workflow</Link>
      </Button>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function getAdvisorAction({
  projectId,
  latestVersionId,
  hasDataset,
  variablesReviewed,
  recommendation,
  analysisState,
}: {
  projectId: string;
  latestVersionId?: string;
  hasDataset: boolean;
  variablesReviewed: boolean;
  recommendation: TestRecommendationResponse | null;
  analysisState: AnalysisWorkflowState | null;
}) {
  if (!hasDataset) {
    return {
      title: "Begin with your dataset",
      message: "No dataset has been uploaded yet. Upload a dataset so StatMentor can profile variables, classify measurement scales, and recommend statistical methods.",
      button: "Upload Dataset",
      href: `/projects/${projectId}/datasets/upload`,
    };
  }
  if (!variablesReviewed) {
    return {
      title: "Review the variable dictionary",
      message: "Dataset uploaded and profiled. Review the variable dictionary to confirm variable types, scales of measurement, and research roles.",
      button: "Review Variables",
      href: latestVersionId
        ? `/dataset-versions/${latestVersionId}/variables`
        : `/projects/${projectId}/datasets`,
    };
  }
  if (!recommendation) {
    return {
      title: "Define the analysis model",
      message: "Variables are available. Select independent and dependent variables to generate defensible statistical test recommendations.",
      button: "Start Analysis Workflow",
      href: `/projects/${projectId}/analysis-workflow`,
    };
  }
  if (!analysisState?.selected_method_key) {
    return {
      title: "Choose the strongest statistical fit",
      message: "StatMentor has generated statistical recommendations. Select the most appropriate test for your study.",
      button: "View Recommendations",
      href: `/projects/${projectId}/analysis-workflow`,
    };
  }
  if (!analysisState.analysis_run) {
    return {
      title: "Run the selected analysis",
      message: "A statistical test has been selected. Run the selected test to generate results and interpretation.",
      button: "Run Analysis",
      href: `/projects/${projectId}/analysis-workflow`,
    };
  }
  return {
    title: "Review your analysis outputs",
    message: "Your analysis results are ready. Review the interpretation and APA-style output.",
    button: "View Results",
    href: `/projects/${projectId}/analysis-workflow`,
  };
}

function getAlerts({
  hasDataset,
  hasVariables,
  variablesReviewed,
  roles,
  missingValues,
  recommendation,
  analysisState,
}: {
  hasDataset: boolean;
  hasVariables: boolean;
  variablesReviewed: boolean;
  roles: ReturnType<typeof summarizeRoles>;
  missingValues: number;
  recommendation: TestRecommendationResponse | null;
  analysisState: AnalysisWorkflowState | null;
}) {
  const alerts: string[] = [];
  if (!hasDataset) alerts.push("No dataset has been uploaded.");
  if (hasDataset && !hasVariables) alerts.push("Variable profiles are not available yet.");
  if (hasVariables && !variablesReviewed) alerts.push("Variable types, scales, and roles need review.");
  if (variablesReviewed && roles.dependent === 0) alerts.push("No dependent variable has been selected.");
  if (variablesReviewed && roles.independent === 0) alerts.push("No independent variable has been selected.");
  if (missingValues > 0) alerts.push(`${missingValues} missing value${missingValues === 1 ? "" : "s"} detected across project datasets.`);
  if (recommendation && !analysisState?.selected_method_key) alerts.push("A statistical test has not been selected.");
  if (analysisState?.selected_method_key && !analysisState.analysis_run) alerts.push("Results have not been generated yet.");
  return alerts;
}

function summarizeVariables(variables: DatasetVariable[]) {
  return variables.reduce(
    (summary, variable) => {
      const kind = variableKind(variable);
      if (kind === "time") summary.time += 1;
      else if (kind === "count") summary.count += 1;
      else if (kind === "numerical") summary.numerical += 1;
      else summary.categorical += 1;
      if (!variable.profile.classification || !variable.profile.scale_detection) {
        summary.needingReview += 1;
      }
      return summary;
    },
    { numerical: 0, categorical: 0, time: 0, count: 0, needingReview: 0 },
  );
}

function summarizeRoles(variables: DatasetVariable[]) {
  return variables.reduce(
    (summary, variable) => {
      const role = variableRole(variable);
      if (role === "independent_variable") summary.independent += 1;
      if (role === "dependent_variable") summary.dependent += 1;
      return summary;
    },
    { independent: 0, dependent: 0 },
  );
}

function variableRole(variable: DatasetVariable): VariableRole {
  const classification = variable.profile.classification as { role?: VariableRole } | undefined;
  return classification?.role ?? "other";
}

function variableKind(variable: DatasetVariable) {
  const name = variable.source_name.toLowerCase();
  if (/(date|time|month|year|quarter|week|day)/.test(name)) return "time";
  if (
    ["integer", "int"].includes(variable.data_type) &&
    /(count|number|frequency|visits|events|cases)/.test(name)
  ) {
    return "count";
  }
  return ["integer", "float", "decimal", "numeric"].includes(variable.data_type)
    ? "numerical"
    : "categorical";
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function availableValue(value: number, availableCount: number) {
  return availableCount ? value : "Not available yet";
}
