"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import type {
  DatasetCatalogItem,
  DatasetDetail,
  ScaleType,
  TestRecommendation,
  TestRecommendationResponse,
  Variable,
  VariableRole,
} from "@/lib/types";
import { titleCase } from "@/lib/utils";
import {
  getAnalysisWorkflowState,
  getRecommendation,
  setActiveProjectId,
  setAnalysisWorkflowState,
  setRecommendation,
  setResearchDesignId,
} from "@/lib/workspace-state";

type Selection = {
  role: VariableRole;
  scale: ScaleType;
};

const roleOptions: VariableRole[] = [
  "other",
  "independent_variable",
  "dependent_variable",
  "control_variable",
  "moderator",
  "mediator",
  "confounding_variable",
];

const scaleOptions: ScaleType[] = ["nominal", "ordinal", "interval", "ratio"];
const variableKindOptions: VariableKind[] = [
  "Numerical",
  "Categorical",
  "Count",
  "Time",
  "Binary",
];

const workflowSteps = [
  "Dataset",
  "Classification",
  "Variables",
  "Recommendation",
  "Test",
  "Run",
  "Results",
  "Interpretation",
  "APA Output",
];

export function AnalysisWorkflow({
  projectId,
  datasets,
}: {
  projectId?: string;
  datasets: (DatasetDetail | DatasetCatalogItem)[];
}) {
  const router = useRouter();
  const readyDatasets = datasets.filter(
    (dataset) => dataset.latest_version?.status === "ready",
  );
  const [datasetId, setDatasetId] = useState(readyDatasets[0]?.id ?? "");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [typeOverrides, setTypeOverrides] = useState<Record<string, VariableKind>>({});
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recommendations, setRecommendations] =
    useState<TestRecommendationResponse | null>(null);
  const [selectedMethodKey, setSelectedMethodKey] = useState("");
  const [hasRun, setHasRun] = useState(false);

  const selectedDataset = readyDatasets.find((dataset) => dataset.id === datasetId);
  const workflowProjectId = projectId ?? selectedDataset?.project_id ?? "";
  const versionId = selectedDataset?.latest_version?.id ?? "";
  const assignedVariables = useMemo(
    () =>
      variables.filter(
        (variable) => (selections[variable.id]?.role ?? "other") !== "other",
      ),
    [selections, variables],
  );
  const dependent = assignedVariables.find(
    (variable) => selections[variable.id]?.role === "dependent_variable",
  );
  const independent = assignedVariables.filter(
    (variable) => selections[variable.id]?.role === "independent_variable",
  );
  const selectedMethod = recommendations?.recommendations.find(
    (method) => method.method_key === selectedMethodKey,
  );

  useEffect(() => {
    if (!versionId) {
      setVariables([]);
      setSelections({});
      setTypeOverrides({});
      return;
    }
    let active = true;
    setLoadingVariables(true);
    setError("");
    api.datasets
      .variables(versionId)
      .then((response) => {
        if (!active) return;
        setVariables(response);
        setTypeOverrides({});
        setSelections(Object.fromEntries(response.map((variable) => [
          variable.id,
          {
            role: storedRole(variable),
            scale: storedScale(variable),
          },
        ])));
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load variables.");
        }
      })
      .finally(() => {
        if (active) setLoadingVariables(false);
      });
    return () => {
      active = false;
    };
  }, [versionId]);

  useEffect(() => {
    if (!projectId && selectedDataset?.project_id) {
      setActiveProjectId(selectedDataset.project_id);
    }
  }, [projectId, selectedDataset?.project_id]);

  useEffect(() => {
    if (!workflowProjectId || !versionId) return;
    const saved = getAnalysisWorkflowState(workflowProjectId);
    if (!saved || saved.dataset_version_id !== versionId) return;
    const savedRecommendation = getRecommendation(workflowProjectId);
    if (savedRecommendation?.dataset_version_id === versionId) {
      setRecommendations(savedRecommendation);
    }
    setSelectedMethodKey(saved.selected_method_key ?? "");
    setHasRun(saved.analysis_run);
  }, [workflowProjectId, versionId]);

  async function detectClassifications() {
    if (!versionId) return;
    setDetecting(true);
    setError("");
    setNotice("");
    try {
      await api.datasets.detectVariables(versionId);
      const refreshed = await api.datasets.variables(versionId);
      setVariables(refreshed);
      setTypeOverrides({});
      setSelections(Object.fromEntries(refreshed.map((variable) => [
        variable.id,
        { role: storedRole(variable), scale: storedScale(variable) },
      ])));
      setNotice("Classification refreshed. Review the explanations and adjust roles or scales if needed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Classification failed.");
    } finally {
      setDetecting(false);
    }
  }

  async function getRecommendations() {
    if (!versionId || !selectedDataset || !workflowProjectId) return;
    if (!dependent || independent.length === 0) {
      setError("Select one dependent variable and at least one independent variable.");
      return;
    }
    setRecommending(true);
    setError("");
    setNotice("");
    setRecommendations(null);
    setSelectedMethodKey("");
    setHasRun(false);
    try {
      await Promise.all(
        assignedVariables.map((variable) => {
          const selection = selections[variable.id];
          return api.datasets.updateVariableMetadata(variable.id, {
            role: selection.role,
            role_confidence: 1,
            role_explanation: "Role confirmed by the researcher in the Analysis Workflow.",
            scale_type: selection.scale,
            scale_confidence: 1,
            scale_explanation:
              "Scale of measurement confirmed by the researcher in the Analysis Workflow.",
          });
        }),
      );

      const studyFocus = inferStudyFocus(independent, dependent, selections);
      const design = await api.researchDesigns.create(workflowProjectId, {
        study_type: "quantitative",
        research_questions: [
          studyFocus === "comparison"
            ? `Does ${dependent.display_name} differ across ${independent[0].display_name} groups?`
            : `What is the relationship between ${independent.map((item) => item.display_name).join(", ")} and ${dependent.display_name}?`,
        ],
        hypotheses: [],
        sample_size: selectedDataset.latest_version?.row_count ?? null,
        temporal_design: variables.some((variable) => variableKind(variable) === "Time")
          ? "longitudinal"
          : "cross_sectional",
        study_focus: studyFocus,
        software_preference: "Python",
        key_constructs: assignedVariables.map((variable) => variable.display_name),
      });
      setResearchDesignId(workflowProjectId, design.id);

      const result = await api.recommendations.create(workflowProjectId, {
        research_design_id: design.id,
        dataset_version_id: versionId,
        variables: assignedVariables.map((variable) => ({
          variable_id: variable.id,
          role: selections[variable.id].role,
          scale_type: selections[variable.id].scale,
        })),
      });
      setRecommendations(result);
      setRecommendation(workflowProjectId, result);
      setSelectedMethodKey("");
      setAnalysisWorkflowState(workflowProjectId, {
        dataset_version_id: versionId,
        selected_method_key: null,
        selected_variables: workflowVariables(),
        analysis_run: false,
        results_interpreted: false,
        apa_report_generated: false,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate recommendations.");
    } finally {
      setRecommending(false);
    }
  }

  async function runSelectedTest() {
    if (!selectedMethod) return;
    setRunning(true);
    setError("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setHasRun(true);
    setAnalysisWorkflowState(workflowProjectId, {
      dataset_version_id: versionId,
      selected_method_key: selectedMethod.method_key,
      selected_variables: workflowVariables(),
      analysis_run: true,
      results_interpreted: true,
      apa_report_generated: true,
    });
    setRunning(false);
    router.push(`/projects/${workflowProjectId}/results`);
  }

  const completedThrough = hasRun
    ? 9
    : selectedMethod
      ? 5
      : recommendations
        ? 4
        : assignedVariables.length
          ? 3
          : variables.length
            ? 2
            : selectedDataset
              ? 1
              : 0;

  return (
    <div className="space-y-6">
      <WorkflowProgress completedThrough={completedThrough} />

      <StepCard number={1} title="Select a dataset" icon={Database}>
        {readyDatasets.length ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_2fr] lg:items-end">
            <div>
              <Label htmlFor="workflow-dataset">Ready dataset</Label>
              <Select
                id="workflow-dataset"
                value={datasetId}
                onChange={(event) => {
                  setDatasetId(event.target.value);
                  setRecommendations(null);
                  setSelectedMethodKey("");
                  setHasRun(false);
                }}
              >
                {readyDatasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {"project_name" in dataset
                      ? `${dataset.name} · ${dataset.project_name}`
                      : dataset.name}
                  </option>
                ))}
              </Select>
            </div>
            {selectedDataset ? (
              <DatasetSummary dataset={selectedDataset} showProject={!projectId} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Upload and process a CSV or Excel dataset before beginning the workflow.
          </p>
        )}
      </StepCard>

      <StepCard number={2} title="Review variable classification" icon={Sparkles}>
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm leading-6 text-slate-600">
            Confirm each detected type and NOIR scale. Explanations show how StatMentor
            reached the classification.
          </p>
          <Button
            variant="teal"
            size="sm"
            onClick={detectClassifications}
            disabled={!versionId || detecting}
          >
            {detecting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Refresh detection
          </Button>
        </div>
        {loadingVariables ? (
          <LoadingMessage label="Loading the variable dictionary…" />
        ) : variables.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Variable</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Why this type?</th>
                  <th className="px-4 py-3">Scale</th>
                  <th className="px-4 py-3">Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variables.map((variable) => {
                  const kind = typeOverrides[variable.id] ?? variableKind(variable);
                  const scale = selections[variable.id]?.scale ?? storedScale(variable);
                  return (
                    <tr key={variable.id} className="align-top">
                      <td className="px-4 py-3 font-semibold text-ink">{variable.source_name}</td>
                      <td className="w-44 px-4 py-3">
                        <Select
                          value={kind}
                          onChange={(event) =>
                            setTypeOverrides((current) => ({
                              ...current,
                              [variable.id]: event.target.value as VariableKind,
                            }))
                          }
                          aria-label={`${variable.display_name} variable type`}
                        >
                          {variableKindOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="max-w-xs px-4 py-3 leading-6 text-slate-600">
                        {typeReason(variable, kind)}
                      </td>
                      <td className="w-40 px-4 py-3">
                        <Select
                          value={scale}
                          onChange={(event) =>
                            updateSelection(variable.id, { scale: event.target.value as ScaleType })
                          }
                          aria-label={`${variable.display_name} scale`}
                        >
                          {scaleOptions.map((option) => (
                            <option key={option} value={option}>{titleCase(option)}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="max-w-sm px-4 py-3 leading-6 text-slate-600">
                        {variableExplanation(variable, kind, scale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Choose a ready dataset to load its variables.</p>
        )}
      </StepCard>

      <StepCard number={3} title="Assign research roles" icon={FlaskConical}>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Choose one dependent variable and at least one independent variable. Controls,
          moderators, and mediators are optional.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {variables.map((variable) => (
            <div
              key={variable.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_210px] sm:items-center"
            >
              <div>
                <p className="font-semibold text-ink">{variable.display_name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {variableKind(variable)} · {titleCase(selections[variable.id]?.scale ?? storedScale(variable))}
                </p>
              </div>
              <Select
                value={selections[variable.id]?.role ?? "other"}
                onChange={(event) =>
                  updateSelection(variable.id, { role: event.target.value as VariableRole })
                }
                aria-label={`${variable.display_name} research role`}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{titleCase(role)}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </StepCard>

      <StepCard number={4} title="Get statistical test recommendations" icon={BarChart3}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="text-sm text-slate-600">
            <p><strong className="text-ink">Independent:</strong> {independent.map((item) => item.display_name).join(", ") || "Not selected"}</p>
            <p className="mt-1"><strong className="text-ink">Dependent:</strong> {dependent?.display_name ?? "Not selected"}</p>
          </div>
          <Button onClick={getRecommendations} disabled={recommending || !variables.length}>
            {recommending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Recommend tests
          </Button>
        </div>
      </StepCard>

      {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700">{notice}</p> : null}

      <StepCard number={5} title="Select a test" icon={CheckCircle2}>
        {recommendations ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.recommendations.map((recommendation, index) => {
              const selected = recommendation.method_key === selectedMethodKey;
              return (
                <button
                  key={recommendation.method_key}
                  type="button"
                  onClick={() => {
                    setSelectedMethodKey(recommendation.method_key);
                    setHasRun(false);
                    setAnalysisWorkflowState(workflowProjectId, {
                      dataset_version_id: versionId,
                      selected_method_key: recommendation.method_key,
                      selected_variables: workflowVariables(),
                      analysis_run: false,
                      results_interpreted: false,
                      apa_report_generated: false,
                    });
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    selected
                      ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge className={index === 0 ? "bg-teal-50 text-teal-700" : ""}>
                        {index === 0 ? "Best fit" : `Option ${index + 1}`}
                      </Badge>
                      <h3 className="mt-3 font-bold text-ink">{recommendation.method_name}</h3>
                    </div>
                    {selected ? <Check className="size-5 text-brand-600" /> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.why_recommended}</p>
                  <p className="mt-3 text-xs font-bold text-violet-600">
                    {Math.round(recommendation.confidence_score * 100)}% confidence
                  </p>
                  <details className="mt-3 text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold text-brand-700">View assumptions</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {recommendation.assumptions.slice(0, 4).map((assumption) => <li key={assumption}>{assumption}</li>)}
                    </ul>
                  </details>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Recommendations will appear after roles and scales are confirmed.</p>
        )}
      </StepCard>

      <StepCard number={6} title="Run selected test" icon={Play}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-600">
            {selectedMethod ? `${selectedMethod.method_name} is selected.` : "Select a recommended method first."}
          </p>
          <Button variant="teal" onClick={runSelectedTest} disabled={!selectedMethod || running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run selected test
          </Button>
        </div>
      </StepCard>

      {hasRun && selectedMethod ? (
        <>
          <StepCard number={7} title="Results" icon={BarChart3}>
            <AnalysisReadyResults
              method={selectedMethod}
              variables={assignedVariables}
              selections={selections}
              sampleSize={selectedDataset?.latest_version?.row_count ?? null}
            />
          </StepCard>
          <StepCard number={8} title="Plain-language interpretation" icon={Sparkles}>
            <p className="leading-7 text-slate-700">
              {selectedMethod.method_name} was selected because {selectedMethod.why_recommended.toLowerCase()} The variables and sample size are ready for execution. Statistical significance, effect size, and direction cannot be interpreted until a statistical execution endpoint returns calculated values.
            </p>
          </StepCard>
          <StepCard number={9} title="APA-style output" icon={FileText}>
            <div className="rounded-xl bg-slate-50 p-5 font-serif text-lg leading-8 text-slate-700">
              A {selectedMethod.method_name.toLowerCase()} was planned to examine the relationship or difference involving {independent.map((item) => item.display_name).join(", ")} and {dependent?.display_name}. Numerical results will be inserted after the selected analysis is executed by the statistical engine.
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              This is an APA-ready template, not a claim of statistical significance.
            </p>
          </StepCard>
        </>
      ) : null}
    </div>
  );

  function updateSelection(variableId: string, patch: Partial<Selection>) {
    setSelections((current) => ({
      ...current,
      [variableId]: {
        role: current[variableId]?.role ?? "other",
        scale: current[variableId]?.scale ?? "nominal",
        ...patch,
      },
    }));
    setRecommendations(null);
    setSelectedMethodKey("");
    setHasRun(false);
  }

  function workflowVariables() {
    return assignedVariables.map((variable) => ({
      variable_id: variable.id,
      source_name: variable.source_name,
      display_name: variable.display_name,
      role: selections[variable.id].role,
      scale_type: selections[variable.id].scale,
    }));
  }
}

function WorkflowProgress({ completedThrough }: { completedThrough: number }) {
  return (
    <Card className="overflow-x-auto p-4">
      <ol className="flex min-w-[900px] items-center">
        {workflowSteps.map((step, index) => {
          const number = index + 1;
          const complete = number <= completedThrough;
          return (
            <li key={step} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${complete ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {complete ? <Check className="size-3.5" /> : number}
                </span>
                <span className="text-xs font-semibold text-slate-600">{step}</span>
              </div>
              {number < workflowSteps.length ? <ChevronRight className="mx-2 size-4 shrink-0 text-slate-300" /> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function StepCard({
  number,
  title,
  icon: Icon,
  children,
}: {
  number: number;
  title: string;
  icon: typeof Database;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step {number}</p>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
        </div>
      </div>
      {children}
    </Card>
  );
}

function DatasetSummary({
  dataset,
  showProject,
}: {
  dataset: DatasetDetail | DatasetCatalogItem;
  showProject: boolean;
}) {
  const version = dataset.latest_version;
  const items = [
    ...(showProject && "project_name" in dataset
      ? [["Project", dataset.project_name] as const]
      : []),
    ["Rows", version?.row_count ?? "—"],
    ["Columns", version?.column_count ?? "—"],
    ["Type", dataset.source_format.toUpperCase()],
    ["Variables", version?.column_count ?? "—"],
  ];
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${
        showProject ? "sm:grid-cols-5" : "sm:grid-cols-4"
      }`}
    >
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingMessage({ label }: { label: string }) {
  return <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="size-4 animate-spin text-brand-600" />{label}</div>;
}

function AnalysisReadyResults({
  method,
  variables,
  selections,
  sampleSize,
}: {
  method: TestRecommendation;
  variables: Variable[];
  selections: Record<string, Selection>;
  sampleSize: number | null;
}) {
  const fields = [
    ["Test Name", method.method_name],
    ["Variables Used", variables.map((variable) => `${variable.display_name} (${titleCase(selections[variable.id].role)})`).join(", ")],
    ["Sample Size", sampleSize ?? "Not available"],
    ["Test Statistic", "Awaiting statistical execution API"],
    ["P-value", "Awaiting statistical execution API"],
    ["Effect Size", "Calculated when supported by the selected method"],
    ["Confidence Interval", "Calculated when supported by the selected method"],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

function storedRole(variable: Variable): VariableRole {
  const classification = variable.profile.classification as { role?: VariableRole } | undefined;
  return classification?.role ?? "other";
}

function storedScale(variable: Variable): ScaleType {
  const detection = variable.profile.scale_detection as { scale_type?: ScaleType } | undefined;
  if (detection?.scale_type) return detection.scale_type;
  if (variable.measurement_level === "nominal" || variable.measurement_level === "ordinal") {
    return variable.measurement_level;
  }
  return "interval";
}

type VariableKind = "Numerical" | "Categorical" | "Count" | "Time" | "Binary";

function variableKind(variable: Variable): VariableKind {
  const name = variable.source_name.toLowerCase();
  const uniqueCount = Number(variable.profile.unique_count);
  if (/(date|time|month|year|quarter|week|day)/.test(name) || ["date", "datetime", "time"].includes(variable.data_type)) return "Time";
  if (uniqueCount === 2 || variable.data_type === "boolean") return "Binary";
  if (["integer", "int"].includes(variable.data_type) && /(count|number|frequency|visits|events|cases)/.test(name)) return "Count";
  return ["integer", "float", "decimal", "numeric"].includes(variable.data_type) ? "Numerical" : "Categorical";
}

function typeReason(variable: Variable, kind: VariableKind) {
  if (kind === "Time") return "Its name or values indicate dates or time periods.";
  if (kind === "Binary") return "It contains two observed categories or true/false values.";
  if (kind === "Count") return "It contains whole-number counts of observed events.";
  if (kind === "Numerical") return variable.data_type === "float" ? "It contains decimal numeric observations." : "It contains numeric observations.";
  return "It contains category labels rather than measured quantities.";
}

function variableExplanation(variable: Variable, kind: VariableKind, scale: ScaleType) {
  const descriptions: Record<ScaleType, string> = {
    nominal: "categories without a natural order",
    ordinal: "categories with a meaningful order",
    interval: "equal intervals without assuming a meaningful absolute zero",
    ratio: "equal intervals and a meaningful zero",
  };
  return `${titleCase(variable.source_name)} is a ${kind.toLowerCase()} variable measured using ${descriptions[scale]}.`;
}

function inferStudyFocus(
  independent: Variable[],
  dependent: Variable,
  selections: Record<string, Selection>,
) {
  const hasNominalPredictor = independent.some(
    (variable) => selections[variable.id].scale === "nominal",
  );
  const continuousOutcome = ["interval", "ratio"].includes(selections[dependent.id].scale);
  return hasNominalPredictor && continuousOutcome ? "comparison" : "relationship";
}
