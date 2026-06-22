"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Variable } from "@/lib/types";
import { titleCase } from "@/lib/utils";

export function VariablesTable({
  versionId,
  initialVariables,
}: {
  versionId: string;
  initialVariables: Variable[];
}) {
  const [variables, setVariables] = useState(initialVariables);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function detect() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await api.datasets.detectVariables(versionId);
      setVariables(response.variables as Variable[]);
      setMessage("Roles and scale types were detected. Review them before analysis.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Classification failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-500">
          {variables.length} variable{variables.length === 1 ? "" : "s"} detected
        </p>
        <Button onClick={detect} disabled={pending} variant="teal">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Run classification detection
        </Button>
      </div>
      {message ? (
        <p className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700">{message}</p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Variable Name</th>
                <th className="px-5 py-4">Type of Variable</th>
                <th className="px-5 py-4">Why This Type?</th>
                <th className="px-5 py-4">Scale of Measurement</th>
                <th className="px-5 py-4">Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variables.map((variable) => {
                const classification = variable.profile.classification as
                  | { role?: string; confidence?: number; explanation?: string }
                  | undefined;
                const scale = variable.profile.scale_detection as
                  | { scale_type?: string; confidence?: number; explanation?: string }
                  | undefined;
                const scaleType = scale?.scale_type ?? fallbackScale(variable.measurement_level);
                const variableType = friendlyVariableType(variable);
                const typeReason = variableTypeReason(variable, variableType);
                const explanation = plainLanguageExplanation(
                  variable,
                  variableType,
                  scaleType,
                );
                return (
                  <tr key={variable.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{variable.source_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className="bg-slate-100 text-slate-600">
                        {variableType}
                      </Badge>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-sm leading-6 text-slate-600">
                      {typeReason}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className="bg-teal-50 text-teal-600">
                        {titleCase(scaleType)}
                      </Badge>
                      {scale?.confidence !== undefined ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {Math.round(scale.confidence * 100)}% confidence
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-md px-5 py-4">
                      <p className="text-sm leading-6 text-slate-600">{explanation}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-600 hover:text-brand-700">
                          View detailed profile
                        </summary>
                        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                          <div>
                            <p className="font-semibold text-slate-400">Research Role</p>
                            <p className="mt-0.5 text-slate-600">
                              {classification?.role
                                ? titleCase(classification.role)
                                : "Not classified"}
                            </p>
                          </div>
                          {classification?.confidence !== undefined ? (
                            <div>
                              <p className="font-semibold text-slate-400">
                                Role Confidence
                              </p>
                              <p className="mt-0.5 text-slate-600">
                                {Math.round(classification.confidence * 100)}%
                              </p>
                            </div>
                          ) : null}
                          {classification?.explanation ? (
                            <div className="col-span-2">
                              <p className="font-semibold text-slate-400">
                                Role Explanation
                              </p>
                              <p className="mt-0.5 text-slate-600">
                                {classification.explanation}
                              </p>
                            </div>
                          ) : null}
                          {profileEntries(variable.profile).map(([key, value]) => (
                            <div key={key}>
                              <p className="font-semibold text-slate-400">{titleCase(key)}</p>
                              <p className="mt-0.5 break-words text-slate-600">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

type FriendlyVariableType = "Numerical" | "Categorical" | "Count" | "Time" | "Binary";

function friendlyVariableType(variable: Variable): FriendlyVariableType {
  const name = variable.source_name.toLowerCase();
  const uniqueCount = Number(variable.profile.unique_count);
  if (
    /(date|time|month|year|quarter|week|day)/.test(name) ||
    ["date", "datetime", "time"].includes(variable.data_type)
  ) {
    return "Time";
  }
  if (uniqueCount === 2 || variable.data_type === "boolean") return "Binary";
  if (
    ["integer", "int"].includes(variable.data_type) &&
    /(count|number|frequency|visits|events|cases)/.test(name)
  ) {
    return "Count";
  }
  return ["integer", "float", "decimal", "numeric"].includes(variable.data_type)
    ? "Numerical"
    : "Categorical";
}

function variableTypeReason(variable: Variable, variableType: FriendlyVariableType) {
  const reasons: Record<FriendlyVariableType, string> = {
    Time: "Its name or stored values indicate dates, time periods, or calendar units.",
    Binary: "It contains two observed categories or true/false values.",
    Count: "It contains whole-number observations representing how often something occurred.",
    Numerical:
      variable.data_type === "float"
        ? "It contains numeric values, including decimal observations."
        : "It contains numeric values that can be meaningfully summarized.",
    Categorical: "It contains labels or groups rather than measured quantities.",
  };
  return reasons[variableType];
}

function fallbackScale(measurementLevel: string) {
  if (measurementLevel === "scale") return "interval";
  return measurementLevel;
}

function plainLanguageExplanation(
  variable: Variable,
  variableType: FriendlyVariableType,
  scaleType: string,
) {
  const scaleDescriptions: Record<string, string> = {
    ratio: "has equal intervals and a meaningful zero",
    interval: "has equal intervals but does not assume a meaningful absolute zero",
    ordinal: "uses categories with a meaningful order",
    nominal: "uses categories without a natural order",
  };
  return `${titleCase(variable.source_name)} is a ${variableType.toLowerCase()} ${scaleType}-scale variable that ${scaleDescriptions[scaleType] ?? "should be reviewed with subject-matter knowledge"}.`;
}

function profileEntries(profile: Record<string, unknown>) {
  return Object.entries(profile).filter(
    ([key, value]) =>
      !["classification", "scale_detection"].includes(key) &&
      ["string", "number", "boolean"].includes(typeof value),
  );
}
