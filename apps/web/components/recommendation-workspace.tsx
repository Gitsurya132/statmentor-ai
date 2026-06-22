"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import type {
  DatasetDetail,
  ScaleType,
  TestRecommendationResponse,
  Variable,
  VariableRole,
} from "@/lib/types";
import { titleCase } from "@/lib/utils";
import { setRecommendation } from "@/lib/workspace-state";

const roles: VariableRole[] = [
  "independent_variable",
  "dependent_variable",
  "mediator",
  "moderator",
  "control_variable",
  "confounding_variable",
  "other",
];
const scales: ScaleType[] = ["nominal", "ordinal", "interval", "ratio"];

type Selection = { role: VariableRole; scale_type: ScaleType; included: boolean };

export function RecommendationWorkspace({
  projectId,
  designId,
  datasets,
}: {
  projectId: string;
  designId: string;
  datasets: DatasetDetail[];
}) {
  const available = datasets.filter((dataset) => dataset.latest_version?.status === "ready");
  const [datasetId, setDatasetId] = useState(available[0]?.id ?? "");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TestRecommendationResponse | null>(null);

  const selectedDataset = available.find((dataset) => dataset.id === datasetId);
  const versionId = selectedDataset?.latest_version?.id ?? "";
  const includedCount = useMemo(
    () => Object.values(selections).filter((selection) => selection.included).length,
    [selections],
  );

  async function loadVariables(nextDatasetId = datasetId) {
    const dataset = available.find((item) => item.id === nextDatasetId);
    const nextVersionId = dataset?.latest_version?.id;
    if (!nextVersionId) return;
    setLoadingVariables(true);
    setError("");
    setResult(null);
    try {
      const response = await api.datasets.variables(nextVersionId);
      setVariables(response);
      setSelections(
        Object.fromEntries(
          response.map((variable) => {
            const classification = variable.profile.classification as
              | { role?: VariableRole }
              | undefined;
            const scale = variable.profile.scale_detection as
              | { scale_type?: ScaleType }
              | undefined;
            return [
              variable.id,
              {
                role: classification?.role ?? "other",
                scale_type:
                  scale?.scale_type ??
                  (variable.measurement_level === "nominal"
                    ? "nominal"
                    : variable.measurement_level === "ordinal"
                      ? "ordinal"
                      : "interval"),
                included: true,
              },
            ];
          }),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load variables.");
    } finally {
      setLoadingVariables(false);
    }
  }

  async function recommend() {
    if (!designId) {
      setError("Create a research design first, then return to this page.");
      return;
    }
    if (!versionId || includedCount === 0) {
      setError("Choose a ready dataset and at least one variable.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await api.recommendations.create(projectId, {
        research_design_id: designId,
        dataset_version_id: versionId,
        variables: Object.entries(selections)
          .filter(([, selection]) => selection.included)
          .map(([variable_id, selection]) => ({
            variable_id,
            role: selection.role,
            scale_type: selection.scale_type,
          })),
      });
      setResult(response);
      setRecommendation(projectId, response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate recommendations.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="dataset">Ready dataset</Label>
            <Select
              id="dataset"
              value={datasetId}
              onChange={(event) => {
                setDatasetId(event.target.value);
                setVariables([]);
                setSelections({});
                setResult(null);
              }}
            >
              {available.length ? null : <option value="">No ready datasets</option>}
              {available.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} · v{dataset.latest_version?.version_number}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={() => loadVariables()}
            disabled={!datasetId || loadingVariables}
          >
            {loadingVariables ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
            Load variables
          </Button>
        </div>
        {!designId ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This page needs a research design ID.{" "}
            <Link href={`/projects/${projectId}/research-design`} className="font-bold underline">
              Create a research design
            </Link>
            .
          </p>
        ) : null}
      </Card>

      {variables.length ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-ink">Confirm selected variables</h2>
            <p className="mt-1 text-sm text-slate-500">
              Roles and scales are prefilled from classification metadata when available.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {variables.map((variable) => {
              const selection = selections[variable.id];
              if (!selection) return null;
              return (
                <div
                  key={variable.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[auto_1fr_220px_170px] md:items-center"
                >
                  <input
                    type="checkbox"
                    checked={selection.included}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [variable.id]: { ...selection, included: event.target.checked },
                      }))
                    }
                    className="size-4 rounded border-slate-300 text-brand-600"
                    aria-label={`Include ${variable.display_name}`}
                  />
                  <div>
                    <p className="font-semibold text-ink">{variable.display_name}</p>
                    <p className="text-xs text-slate-400">{titleCase(variable.data_type)}</p>
                  </div>
                  <Select
                    value={selection.role}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [variable.id]: {
                          ...selection,
                          role: event.target.value as VariableRole,
                        },
                      }))
                    }
                    aria-label={`${variable.display_name} role`}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {titleCase(role)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={selection.scale_type}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [variable.id]: {
                          ...selection,
                          scale_type: event.target.value as ScaleType,
                        },
                      }))
                    }
                    aria-label={`${variable.display_name} scale`}
                  >
                    {scales.map((scale) => (
                      <option key={scale} value={scale}>
                        {titleCase(scale)}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col justify-between gap-3 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">{includedCount} variables selected</p>
            <Button onClick={recommend} disabled={pending || includedCount === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Get recommendation
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="size-5 text-teal-600" />
            <h2 className="text-xl font-bold text-ink">Recommended methods</h2>
          </div>
          <div className="grid gap-5">
            {result.recommendations.map((recommendation, index) => (
              <Card key={recommendation.method_key} className="p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={index === 0 ? "bg-teal-50 text-teal-600" : ""}>
                        {index === 0 ? "Best fit" : `Option ${index + 1}`}
                      </Badge>
                      <span className="text-sm font-bold text-violet-600">
                        {Math.round(recommendation.confidence_score * 100)}% confidence
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-ink">
                      {recommendation.method_name}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {recommendation.why_recommended}
                    </p>
                  </div>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                    <FlaskConical className="size-5" />
                  </span>
                </div>
                <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
                  <ListBlock title="Assumptions" items={recommendation.assumptions} />
                  <ListBlock title="Advantages" items={recommendation.advantages} />
                </div>
                {index === 0 ? (
                  <Button asChild className="mt-6">
                    <Link
                      href={`/projects/${projectId}/results?method=${recommendation.method_key}`}
                    >
                      Continue to results
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">{result.advisory_note}</p>
        </div>
      ) : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
