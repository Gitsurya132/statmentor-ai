import type { ScaleType, VariableRole } from "@/lib/types";

export interface AnalysisVariable {
  variable_id: string;
  source_name: string;
  display_name: string;
  role: VariableRole;
  scale_type: ScaleType;
}

export interface ResultMetric {
  label: string;
  value: string;
  interpretation?: string;
}

export interface AssumptionResult {
  name: string;
  status: "passed" | "warning" | "failed";
  explanation: string;
}

export interface ChartSpec {
  type: "scatter" | "bar" | "line" | "distribution";
  title: string;
  xLabel: string;
  yLabel: string;
  points?: { x: number; y: number }[];
  bars?: { label: string; value: number }[];
  trendline?: { x1: number; y1: number; x2: number; y2: number };
}

export interface AnalysisResult {
  methodKey: string;
  methodName: string;
  sampleSize: number;
  metrics: ResultMetric[];
  assumptions: AssumptionResult[];
  effectSize: { name: string; value: string; magnitude: string };
  interpretation: string;
  apa: string;
  findings: string[];
  nextSteps: string[];
  chart: ChartSpec | null;
  generatedAt: string;
  engine: string;
}

export interface AnalysisEngine {
  run(input: {
    methodKey: string;
    rows: Record<string, unknown>[];
    variables: AnalysisVariable[];
  }): AnalysisResult;
}
