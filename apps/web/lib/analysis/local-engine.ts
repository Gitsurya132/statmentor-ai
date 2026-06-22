import type {
  AnalysisEngine,
  AnalysisResult,
  AnalysisVariable,
  AssumptionResult,
  ChartSpec,
  ResultMetric,
} from "@/lib/analysis/types";

type Pair = { x: number; y: number };

export class LocalAnalysisEngine implements AnalysisEngine {
  run({
    methodKey,
    rows,
    variables,
  }: {
    methodKey: string;
    rows: Record<string, unknown>[];
    variables: AnalysisVariable[];
  }): AnalysisResult {
    const ivs = variables.filter((variable) => variable.role === "independent_variable");
    const dv = variables.find((variable) => variable.role === "dependent_variable");
    if (!dv) throw new Error("A dependent variable is required.");

    if (methodKey === "pearson_correlation" || methodKey === "spearman_correlation") {
      return correlationResult(methodKey, rows, ivs[0], dv);
    }
    if (methodKey === "linear_regression") {
      return regressionResult(rows, ivs[0], dv);
    }
    if (methodKey === "independent_t_test") {
      return tTestResult(rows, ivs[0], dv);
    }
    if (methodKey === "one_way_anova") {
      return anovaResult(rows, ivs[0], dv);
    }
    if (methodKey === "cronbach_alpha") {
      return alphaResult(rows, variables);
    }
    return descriptiveResult(rows, variables);
  }
}

function correlationResult(
  methodKey: string,
  rows: Record<string, unknown>[],
  iv: AnalysisVariable | undefined,
  dv: AnalysisVariable,
): AnalysisResult {
  if (!iv) throw new Error("An independent variable is required.");
  let pairs = numericPairs(rows, iv.source_name, dv.source_name);
  if (pairs.length < 4) {
    throw new Error("At least four complete paired observations are required.");
  }
  if (methodKey === "spearman_correlation") {
    const xRanks = ranks(pairs.map((pair) => pair.x));
    const yRanks = ranks(pairs.map((pair) => pair.y));
    pairs = pairs.map((_, index) => ({ x: xRanks[index], y: yRanks[index] }));
  }
  const r = correlation(pairs);
  const df = pairs.length - 2;
  const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
  const p = twoTailedT(Math.abs(t), df);
  const methodName =
    methodKey === "spearman_correlation" ? "Spearman Correlation" : "Pearson Correlation";
  const symbol = methodKey === "spearman_correlation" ? "ρ" : "r";
  const significant = p < 0.05;
  const direction = r >= 0 ? "positive" : "negative";
  const magnitude = correlationMagnitude(Math.abs(r));
  return baseResult({
    methodKey,
    methodName,
    sampleSize: pairs.length,
    metrics: [
      { label: `${symbol}-value`, value: format(r, 3) },
      { label: "p-value", value: formatP(p) },
      { label: "Degrees of freedom", value: String(df) },
      { label: "95% confidence interval", value: correlationCI(r, pairs.length) },
    ],
    assumptions: commonAssumptions(pairs),
    effectSize: { name: symbol, value: format(Math.abs(r), 3), magnitude },
    interpretation: `${iv.display_name} and ${dv.display_name} showed a ${magnitude.toLowerCase()} ${direction} association. The relationship was ${significant ? "" : "not "}statistically significant at α = .05.`,
    apa: `A ${methodName.toLowerCase()} examined the association between ${iv.display_name} and ${dv.display_name}. The analysis indicated a ${magnitude.toLowerCase()} ${direction} association, ${symbol}(${df}) = ${apaNumber(r)}, p ${apaP(p)}.`,
    findings: [
      `The association was ${direction}.`,
      `The observed effect was ${magnitude.toLowerCase()}.`,
      `The result was ${significant ? "" : "not "}statistically significant.`,
    ],
    chart: scatterChart(iv, dv, numericPairs(rows, iv.source_name, dv.source_name)),
  });
}

function regressionResult(
  rows: Record<string, unknown>[],
  iv: AnalysisVariable | undefined,
  dv: AnalysisVariable,
): AnalysisResult {
  if (!iv) throw new Error("An independent variable is required.");
  const pairs = numericPairs(rows, iv.source_name, dv.source_name);
  if (pairs.length < 4) {
    throw new Error("At least four complete paired observations are required.");
  }
  const x = pairs.map((pair) => pair.x);
  const y = pairs.map((pair) => pair.y);
  const xMean = mean(x);
  const yMean = mean(y);
  const sxx = sum(x.map((value) => (value - xMean) ** 2));
  const slope = sum(pairs.map((pair) => (pair.x - xMean) * (pair.y - yMean))) / sxx;
  const intercept = yMean - slope * xMean;
  const fitted = x.map((value) => intercept + slope * value);
  const residuals = y.map((value, index) => value - fitted[index]);
  const sse = sum(residuals.map((value) => value ** 2));
  const sst = sum(y.map((value) => (value - yMean) ** 2));
  const r2 = 1 - sse / sst;
  const df = pairs.length - 2;
  const se = Math.sqrt(sse / df / sxx);
  const t = slope / se;
  const p = twoTailedT(Math.abs(t), df);
  const adjusted = 1 - (1 - r2) * ((pairs.length - 1) / df);
  const critical = 1.96;
  const significant = p < 0.05;
  return baseResult({
    methodKey: "linear_regression",
    methodName: "Linear Regression",
    sampleSize: pairs.length,
    metrics: [
      { label: "R²", value: format(r2, 3) },
      { label: "Adjusted R²", value: format(adjusted, 3) },
      { label: "Coefficient (B)", value: format(slope, 3) },
      { label: "Standard error", value: format(se, 3) },
      { label: "p-value", value: formatP(p) },
      {
        label: "95% confidence interval",
        value: `[${format(slope - critical * se, 3)}, ${format(slope + critical * se, 3)}]`,
      },
    ],
    assumptions: regressionAssumptions(pairs, residuals),
    effectSize: {
      name: "R²",
      value: format(r2, 3),
      magnitude: r2 >= 0.26 ? "Large" : r2 >= 0.13 ? "Medium" : "Small",
    },
    interpretation: `${iv.display_name} ${significant ? "significantly predicted" : "did not significantly predict"} ${dv.display_name}. A one-unit increase in ${iv.display_name} was associated with a ${format(slope, 2)}-unit ${slope >= 0 ? "increase" : "decrease"} in ${dv.display_name}. The model explained ${format(r2 * 100, 1)}% of the observed variance.`,
    apa: `A simple linear regression was conducted to determine whether ${iv.display_name} predicted ${dv.display_name}. ${iv.display_name} ${significant ? "significantly predicted" : "did not significantly predict"} ${dv.display_name}, B = ${apaNumber(slope)}, SE = ${apaNumber(se)}, p ${apaP(p)}. The model explained ${format(r2 * 100, 1)}% of the variance, R² = ${apaNumber(r2)}.`,
    findings: [
      `${iv.display_name} had a ${slope >= 0 ? "positive" : "negative"} coefficient.`,
      `The model explained ${format(r2 * 100, 1)}% of outcome variance.`,
      `The predictor was ${significant ? "" : "not "}statistically significant.`,
    ],
    chart: scatterChart(iv, dv, pairs, { slope, intercept }),
  });
}

function tTestResult(
  rows: Record<string, unknown>[],
  iv: AnalysisVariable | undefined,
  dv: AnalysisVariable,
): AnalysisResult {
  if (!iv) throw new Error("A grouping variable is required.");
  const grouped = groupedNumbers(rows, iv.source_name, dv.source_name);
  const groups = [...grouped.entries()].slice(0, 2);
  if (groups.length !== 2) throw new Error("The t-test requires exactly two observed groups.");
  const [aName, a] = groups[0];
  const [bName, b] = groups[1];
  const meanA = mean(a);
  const meanB = mean(b);
  const varA = variance(a);
  const varB = variance(b);
  const se = Math.sqrt(varA / a.length + varB / b.length);
  const t = (meanA - meanB) / se;
  const df =
    (varA / a.length + varB / b.length) ** 2 /
    ((varA / a.length) ** 2 / (a.length - 1) +
      (varB / b.length) ** 2 / (b.length - 1));
  const p = twoTailedT(Math.abs(t), df);
  const pooled = Math.sqrt(
    ((a.length - 1) * varA + (b.length - 1) * varB) /
      (a.length + b.length - 2),
  );
  const d = (meanA - meanB) / pooled;
  const magnitude = Math.abs(d) >= 0.8 ? "Large" : Math.abs(d) >= 0.5 ? "Medium" : "Small";
  return baseResult({
    methodKey: "independent_t_test",
    methodName: "Independent Samples t-test",
    sampleSize: a.length + b.length,
    metrics: [
      { label: `${aName} mean`, value: format(meanA, 2) },
      { label: `${bName} mean`, value: format(meanB, 2) },
      { label: "t-value", value: format(t, 3) },
      { label: "Degrees of freedom", value: format(df, 1) },
      { label: "p-value", value: formatP(p) },
      { label: "Mean difference", value: format(meanA - meanB, 3) },
    ],
    assumptions: [
      normalityAssumption([...a, ...b]),
      {
        name: "Independent observations",
        status: "passed",
        explanation: "Each row is treated as an independent observation; verify this against the study design.",
      },
      {
        name: "Variance similarity",
        status: Math.max(varA, varB) / Math.max(1e-12, Math.min(varA, varB)) < 4 ? "passed" : "warning",
        explanation: "Group variance ratio was inspected as a practical screening check.",
      },
    ],
    effectSize: { name: "Cohen's d", value: format(d, 3), magnitude },
    interpretation: `${aName} and ${bName} differed by ${format(Math.abs(meanA - meanB), 2)} units on ${dv.display_name}. This difference was ${p < 0.05 ? "" : "not "}statistically significant and represented a ${magnitude.toLowerCase()} effect.`,
    apa: `An independent-samples t-test compared ${dv.display_name} between ${aName} and ${bName}. The difference was ${p < 0.05 ? "" : "not "}statistically significant, t(${format(df, 1)}) = ${apaNumber(t)}, p ${apaP(p)}, d = ${apaNumber(d)}.`,
    findings: [
      `${aName} mean: ${format(meanA, 2)}; ${bName} mean: ${format(meanB, 2)}.`,
      `The group difference was ${p < 0.05 ? "" : "not "}statistically significant.`,
      `The effect size was ${magnitude.toLowerCase()}.`,
    ],
    chart: barChart(iv, dv, groups.map(([label, values]) => ({ label, value: mean(values) }))),
  });
}

function anovaResult(
  rows: Record<string, unknown>[],
  iv: AnalysisVariable | undefined,
  dv: AnalysisVariable,
): AnalysisResult {
  if (!iv) throw new Error("A grouping variable is required.");
  const groups = [...groupedNumbers(rows, iv.source_name, dv.source_name).entries()].filter(
    ([, values]) => values.length > 1,
  );
  if (groups.length < 2) throw new Error("ANOVA requires at least two observed groups.");
  const all = groups.flatMap(([, values]) => values);
  const grand = mean(all);
  const between = sum(groups.map(([, values]) => values.length * (mean(values) - grand) ** 2));
  const within = sum(
    groups.map(([, values]) => sum(values.map((value) => (value - mean(values)) ** 2))),
  );
  const df1 = groups.length - 1;
  const df2 = all.length - groups.length;
  const f = (between / df1) / (within / df2);
  const p = 1 - fCdf(f, df1, df2);
  const eta = between / (between + within);
  const magnitude = eta >= 0.14 ? "Large" : eta >= 0.06 ? "Medium" : "Small";
  return baseResult({
    methodKey: "one_way_anova",
    methodName: "One-Way ANOVA",
    sampleSize: all.length,
    metrics: [
      { label: "F-statistic", value: format(f, 3) },
      { label: "Between df", value: String(df1) },
      { label: "Within df", value: String(df2) },
      { label: "p-value", value: formatP(p) },
      { label: "Eta squared", value: format(eta, 3) },
    ],
    assumptions: [
      normalityAssumption(all),
      {
        name: "Independent observations",
        status: "passed",
        explanation: "Rows are treated as independent; confirm this assumption from the sampling design.",
      },
      {
        name: "Homogeneity of variance",
        status: varianceRatio(groups.map(([, values]) => values)) < 4 ? "passed" : "warning",
        explanation: "Group variances were compared using a practical variance-ratio screen.",
      },
    ],
    effectSize: { name: "Eta squared", value: format(eta, 3), magnitude },
    interpretation: `${dv.display_name} ${p < 0.05 ? "differed significantly" : "did not differ significantly"} across ${iv.display_name} groups. The group effect was ${magnitude.toLowerCase()} and explained ${format(eta * 100, 1)}% of the outcome variance.`,
    apa: `A one-way ANOVA examined differences in ${dv.display_name} across ${iv.display_name} groups. The effect was ${p < 0.05 ? "" : "not "}statistically significant, F(${df1}, ${df2}) = ${apaNumber(f)}, p ${apaP(p)}, η² = ${apaNumber(eta)}.`,
    findings: [
      `${groups.length} groups were compared.`,
      `The omnibus result was ${p < 0.05 ? "" : "not "}statistically significant.`,
      `The effect size was ${magnitude.toLowerCase()}.`,
    ],
    chart: barChart(iv, dv, groups.map(([label, values]) => ({ label, value: mean(values) }))),
  });
}

function alphaResult(
  rows: Record<string, unknown>[],
  variables: AnalysisVariable[],
): AnalysisResult {
  const keys = variables.map((variable) => variable.source_name);
  const matrix = rows
    .map((row) => keys.map((key) => numberValue(row[key])))
    .filter((values): values is number[] => values.every((value) => value !== null));
  const itemVariances = keys.map((_, index) => variance(matrix.map((row) => row[index])));
  const totals = matrix.map((row) => sum(row));
  const k = keys.length;
  const alpha = (k / (k - 1)) * (1 - sum(itemVariances) / variance(totals));
  const magnitude = alpha >= 0.9 ? "Excellent" : alpha >= 0.8 ? "Good" : alpha >= 0.7 ? "Acceptable" : "Needs review";
  return baseResult({
    methodKey: "cronbach_alpha",
    methodName: "Cronbach Alpha",
    sampleSize: matrix.length,
    metrics: [
      { label: "Cronbach's α", value: format(alpha, 3) },
      { label: "Number of items", value: String(k) },
      { label: "Complete cases", value: String(matrix.length) },
    ],
    assumptions: [
      {
        name: "Multiple scale items",
        status: k >= 2 ? "passed" : "failed",
        explanation: `${k} item variables were included.`,
      },
      {
        name: "Complete cases",
        status: matrix.length >= 20 ? "passed" : "warning",
        explanation: `${matrix.length} rows contained values for every selected item.`,
      },
    ],
    effectSize: { name: "Internal consistency", value: format(alpha, 3), magnitude },
    interpretation: `The selected ${k}-item scale demonstrated ${magnitude.toLowerCase()} internal consistency (α = ${format(alpha, 2)}).`,
    apa: `The internal consistency of the ${k}-item measure was ${magnitude.toLowerCase()}, Cronbach's α = ${apaNumber(alpha)}.`,
    findings: [`Internal consistency was ${magnitude.toLowerCase()}.`, `${matrix.length} complete cases were analyzed.`],
    chart: {
      type: "bar",
      title: "Item Variability",
      xLabel: "Scale item",
      yLabel: "Variance",
      bars: variables.map((variable, index) => ({ label: variable.display_name, value: itemVariances[index] })),
    },
  });
}

function descriptiveResult(
  rows: Record<string, unknown>[],
  variables: AnalysisVariable[],
): AnalysisResult {
  const variable = variables[0];
  if (!variable) throw new Error("Select at least one variable.");
  const values = rows.map((row) => numberValue(row[variable.source_name])).filter((value): value is number => value !== null);
  const metrics: ResultMetric[] = values.length
    ? [
        { label: "N", value: String(values.length) },
        { label: "Mean", value: format(mean(values), 3) },
        { label: "Standard deviation", value: format(Math.sqrt(variance(values)), 3) },
        { label: "Minimum", value: format(Math.min(...values), 3) },
        { label: "Maximum", value: format(Math.max(...values), 3) },
      ]
    : [{ label: "N", value: String(rows.length) }];
  return baseResult({
    methodKey: "descriptive_statistics",
    methodName: "Descriptive Statistics",
    sampleSize: values.length || rows.length,
    metrics,
    assumptions: [{ name: "Data availability", status: rows.length ? "passed" : "failed", explanation: `${rows.length} rows were available.` }],
    effectSize: { name: "Not applicable", value: "—", magnitude: "Descriptive" },
    interpretation: `Descriptive statistics summarize the observed distribution of ${variable.display_name}.`,
    apa: `Descriptive statistics were calculated for ${variable.display_name} using ${values.length || rows.length} observations.`,
    findings: ["The dataset was summarized without inferential claims."],
    chart: values.length ? distributionChart(variable, values) : null,
  });
}

function baseResult(input: Omit<AnalysisResult, "generatedAt" | "engine" | "nextSteps">): AnalysisResult {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    engine: "StatMentor deterministic local analysis adapter",
    nextSteps: [
      "Include the verified statistical findings in Chapter 4.",
      "Discuss practical and theoretical implications in Chapter 5.",
      "Document assumption warnings and sensitivity checks.",
    ],
  };
}

function numericPairs(rows: Record<string, unknown>[], xKey: string, yKey: string): Pair[] {
  return rows.flatMap((row) => {
    const x = numberValue(row[xKey]);
    const y = numberValue(row[yKey]);
    return x === null || y === null ? [] : [{ x, y }];
  });
}

function groupedNumbers(rows: Record<string, unknown>[], groupKey: string, valueKey: string) {
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    const group = row[groupKey];
    const value = numberValue(row[valueKey]);
    if (group === null || group === undefined || value === null) return;
    const key = String(group);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  });
  return groups;
}

function scatterChart(
  iv: AnalysisVariable,
  dv: AnalysisVariable,
  points: Pair[],
  model?: { slope: number; intercept: number },
): ChartSpec {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const r = correlation(points);
  const slope = model?.slope ?? (standardDeviation(points.map((point) => point.y)) / standardDeviation(points.map((point) => point.x))) * r;
  const intercept = model?.intercept ?? mean(points.map((point) => point.y)) - slope * mean(points.map((point) => point.x));
  return {
    type: "scatter",
    title: `${iv.display_name} vs ${dv.display_name}`,
    xLabel: iv.display_name,
    yLabel: dv.display_name,
    points,
    trendline: { x1: minX, y1: intercept + slope * minX, x2: maxX, y2: intercept + slope * maxX },
  };
}

function barChart(iv: AnalysisVariable, dv: AnalysisVariable, bars: { label: string; value: number }[]): ChartSpec {
  return { type: "bar", title: `${dv.display_name} by ${iv.display_name}`, xLabel: iv.display_name, yLabel: `Average ${dv.display_name}`, bars };
}

function distributionChart(variable: AnalysisVariable, values: number[]): ChartSpec {
  const buckets = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min || 1) / buckets;
  const bars = Array.from({ length: buckets }, (_, index) => ({ label: format(min + index * width, 1), value: 0 }));
  values.forEach((value) => {
    const index = Math.min(buckets - 1, Math.floor((value - min) / width));
    bars[index].value += 1;
  });
  return { type: "distribution", title: `${variable.display_name} Distribution`, xLabel: variable.display_name, yLabel: "Count", bars };
}

function commonAssumptions(pairs: Pair[]): AssumptionResult[] {
  return [
    normalityAssumption(pairs.flatMap((pair) => [pair.x, pair.y])),
    {
      name: "Linearity",
      status: Math.abs(correlation(pairs)) >= 0.2 ? "passed" : "warning",
      explanation: "The observed association was screened for a meaningful linear pattern.",
    },
    {
      name: "Independent observations",
      status: "passed",
      explanation: "Rows are treated as independent; confirm this from the study design.",
    },
  ];
}

function regressionAssumptions(pairs: Pair[], residuals: number[]): AssumptionResult[] {
  return [
    normalityAssumption(residuals),
    {
      name: "Linearity",
      status: Math.abs(correlation(pairs)) >= 0.2 ? "passed" : "warning",
      explanation: "Predictor and outcome were screened for a linear relationship.",
    },
    {
      name: "Homoscedasticity",
      status: residualSpreadRatio(pairs, residuals) < 2.5 ? "passed" : "warning",
      explanation: "Residual spread was compared across lower and upper fitted-value halves.",
    },
    {
      name: "Independence",
      status: "passed",
      explanation: "Rows are treated as independent; verify this against data collection procedures.",
    },
  ];
}

function normalityAssumption(values: number[]): AssumptionResult {
  const skew = Math.abs(skewness(values));
  return {
    name: "Approximate normality",
    status: skew <= 1 ? "passed" : skew <= 2 ? "warning" : "failed",
    explanation: `Absolute skewness was ${format(skew, 2)}; this is a screening diagnostic rather than a formal normality test.`,
  };
}

function residualSpreadRatio(pairs: Pair[], residuals: number[]) {
  const sorted = pairs.map((pair, index) => ({ x: pair.x, residual: residuals[index] })).sort((a, b) => a.x - b.x);
  const half = Math.floor(sorted.length / 2);
  const low = variance(sorted.slice(0, half).map((item) => item.residual));
  const high = variance(sorted.slice(half).map((item) => item.residual));
  return Math.max(low, high) / Math.max(1e-12, Math.min(low, high));
}

function varianceRatio(groups: number[][]) {
  const variances = groups.map(variance).filter((value) => value > 0);
  return Math.max(...variances) / Math.max(1e-12, Math.min(...variances));
}

function ranks(values: number[]) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array(values.length).fill(0);
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[start].value) end += 1;
    const rank = (start + end + 2) / 2;
    for (let index = start; index <= end; index += 1) result[sorted[index].index] = rank;
    start = end + 1;
  }
  return result;
}

function correlation(pairs: Pair[]) {
  const x = pairs.map((pair) => pair.x);
  const y = pairs.map((pair) => pair.y);
  const xMean = mean(x);
  const yMean = mean(y);
  const numerator = sum(pairs.map((pair) => (pair.x - xMean) * (pair.y - yMean)));
  return numerator / Math.sqrt(sum(x.map((value) => (value - xMean) ** 2)) * sum(y.map((value) => (value - yMean) ** 2)));
}

function correlationCI(r: number, n: number) {
  if (n <= 3 || Math.abs(r) >= 1) return "Not available";
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const lower = Math.tanh(z - 1.96 * se);
  const upper = Math.tanh(z + 1.96 * se);
  return `[${format(lower, 3)}, ${format(upper, 3)}]`;
}

function correlationMagnitude(value: number) {
  return value >= 0.5 ? "Large" : value >= 0.3 ? "Medium" : "Small";
}

function mean(values: number[]) {
  return sum(values) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const center = mean(values);
  return sum(values.map((value) => (value - center) ** 2)) / (values.length - 1);
}

function standardDeviation(values: number[]) {
  return Math.sqrt(variance(values));
}

function skewness(values: number[]) {
  if (values.length < 3) return 0;
  const center = mean(values);
  const sd = standardDeviation(values);
  return sum(values.map((value) => ((value - center) / sd) ** 3)) / values.length;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function twoTailedT(t: number, df: number) {
  if (!Number.isFinite(t) || df <= 0) return 1;
  const x = df / (df + t * t);
  return regularizedBeta(x, df / 2, 0.5);
}

function fCdf(f: number, df1: number, df2: number) {
  return regularizedBeta((df1 * f) / (df1 * f + df2), df1 / 2, df2 / 2);
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaFraction(x, a, b)) / a;
  return 1 - (front * betaFraction(1 - x, b, a)) / b;
}

function betaFraction(x: number, a: number, b: number) {
  const max = 200;
  const eps = 3e-12;
  const fpmin = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= max; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }
  return h;
}

function logGamma(z: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019571e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => {
    x += coefficient / (z + index + 1);
  });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function format(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : "Not available";
}

function formatP(value: number) {
  return value < 0.001 ? "< .001" : format(value, 3);
}

function apaP(value: number) {
  return value < 0.001 ? "< .001" : `= ${value.toFixed(3).replace(/^0/, "")}`;
}

function apaNumber(value: number) {
  const fixed = value.toFixed(2);
  return Math.abs(value) < 1 ? fixed.replace(/^(-?)0/, "$1") : fixed;
}
