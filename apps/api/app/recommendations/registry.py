from __future__ import annotations

from dataclasses import dataclass

from app.db.enums import AnalysisMethod


@dataclass(frozen=True)
class MethodDefinition:
    method_key: AnalysisMethod
    method_name: str
    description: str
    required_variables: list[str]
    assumptions: list[str]
    sample_size_guidance: str
    advantages: list[str]
    limitations: list[str]
    alternatives: list[AnalysisMethod]


METHODS: dict[AnalysisMethod, MethodDefinition] = {
    AnalysisMethod.DESCRIPTIVE_STATISTICS: MethodDefinition(
        method_key=AnalysisMethod.DESCRIPTIVE_STATISTICS,
        method_name="Descriptive Statistics",
        description="Summarizes distributions, central tendency, dispersion, and frequencies.",
        required_variables=["One or more selected variables of any supported scale type."],
        assumptions=[
            "Observations are measured consistently.",
            "The selected summaries are appropriate for each variable's scale.",
        ],
        sample_size_guidance=(
            "No universal minimum; report valid and missing observations for every variable."
        ),
        advantages=[
            "Provides an essential first view of the data.",
            "Supports all variable scale types.",
        ],
        limitations=[
            "Does not test hypotheses or establish relationships.",
            "Summary measures may conceal distributional problems.",
        ],
        alternatives=[],
    ),
    AnalysisMethod.PEARSON_CORRELATION: MethodDefinition(
        method_key=AnalysisMethod.PEARSON_CORRELATION,
        method_name="Pearson Correlation",
        description="Measures the strength and direction of a linear relationship.",
        required_variables=["At least two interval or ratio variables."],
        assumptions=[
            "Independent observations",
            "Linear relationship",
            "Approximate bivariate normality for inference",
            "No extreme influential outliers",
        ],
        sample_size_guidance=(
            "Use an a priori power analysis; larger samples are needed for small correlations."
        ),
        advantages=[
            "Widely understood standardized association measure.",
            "Supports confidence intervals and significance testing.",
        ],
        limitations=[
            "Sensitive to outliers and nonlinearity.",
            "Correlation does not establish causation.",
        ],
        alternatives=[
            AnalysisMethod.SPEARMAN_CORRELATION,
            AnalysisMethod.LINEAR_REGRESSION,
        ],
    ),
    AnalysisMethod.SPEARMAN_CORRELATION: MethodDefinition(
        method_key=AnalysisMethod.SPEARMAN_CORRELATION,
        method_name="Spearman Correlation",
        description="Measures the strength of a monotonic relationship using ranks.",
        required_variables=["At least two ordinal, interval, or ratio variables."],
        assumptions=[
            "Independent observations",
            "Variables are at least ordinal",
            "A monotonic relationship is plausible",
        ],
        sample_size_guidance=(
            "Use an a priori power analysis; small samples yield imprecise rank correlations."
        ),
        advantages=[
            "Does not require normally distributed variables.",
            "Useful for ordinal measures and monotonic nonlinear relationships.",
        ],
        limitations=[
            "Less efficient than Pearson correlation when Pearson assumptions hold.",
            "Does not model adjustment variables.",
        ],
        alternatives=[
            AnalysisMethod.PEARSON_CORRELATION,
            AnalysisMethod.LINEAR_REGRESSION,
        ],
    ),
    AnalysisMethod.INDEPENDENT_T_TEST: MethodDefinition(
        method_key=AnalysisMethod.INDEPENDENT_T_TEST,
        method_name="Independent Samples t-test",
        description="Compares the mean of a continuous outcome between two independent groups.",
        required_variables=[
            "One nominal independent variable with exactly two groups.",
            "One interval or ratio dependent variable.",
        ],
        assumptions=[
            "Independent observations and groups",
            "Approximately normal outcome within groups",
            "No extreme outliers",
            "Homogeneity of variance for the pooled-variance form",
        ],
        sample_size_guidance=(
            "Use an a priori two-group power analysis and retain adequate observations per group."
        ),
        advantages=[
            "Direct and interpretable two-group mean comparison.",
            "Welch's form can reduce sensitivity to unequal variances.",
        ],
        limitations=[
            "Limited to two independent groups.",
            "Does not adjust for multiple predictors or confounders.",
        ],
        alternatives=[
            AnalysisMethod.ONE_WAY_ANOVA,
            AnalysisMethod.LINEAR_REGRESSION,
        ],
    ),
    AnalysisMethod.ONE_WAY_ANOVA: MethodDefinition(
        method_key=AnalysisMethod.ONE_WAY_ANOVA,
        method_name="One-Way ANOVA",
        description="Compares a continuous outcome across three or more independent groups.",
        required_variables=[
            "One nominal independent variable with three or more groups.",
            "One interval or ratio dependent variable.",
        ],
        assumptions=[
            "Independent observations and groups",
            "Approximately normal residuals within groups",
            "Homogeneity of variance",
            "No extreme influential outliers",
        ],
        sample_size_guidance=(
            "Use an a priori omnibus power analysis and maintain adequate observations per group."
        ),
        advantages=[
            "Tests an overall group difference without inflating pairwise Type I error.",
            "Can be followed by controlled post-hoc comparisons.",
        ],
        limitations=[
            "An omnibus result does not identify which groups differ.",
            "Only one grouping factor is supported in the MVP method.",
        ],
        alternatives=[
            AnalysisMethod.INDEPENDENT_T_TEST,
            AnalysisMethod.LINEAR_REGRESSION,
        ],
    ),
    AnalysisMethod.LINEAR_REGRESSION: MethodDefinition(
        method_key=AnalysisMethod.LINEAR_REGRESSION,
        method_name="Linear Regression",
        description="Models a continuous dependent variable from one or more predictors.",
        required_variables=[
            "One interval or ratio dependent variable.",
            "One or more independent, control, moderator, mediator, or confounding variables.",
        ],
        assumptions=[
            "Independent observations",
            "Linear functional form",
            "Homoscedastic residuals",
            "Approximately normal residuals for inference",
            "No problematic multicollinearity",
            "No unduly influential observations",
        ],
        sample_size_guidance=(
            "Use an a priori regression power analysis; required sample grows with predictors."
        ),
        advantages=[
            "Supports multiple predictors and adjustment variables.",
            "Produces interpretable coefficients and model-fit summaries.",
        ],
        limitations=[
            "MVP linear regression does not itself implement mediation or moderation analysis.",
            "Results depend on correct functional form and measured confounders.",
        ],
        alternatives=[
            AnalysisMethod.PEARSON_CORRELATION,
            AnalysisMethod.SPEARMAN_CORRELATION,
        ],
    ),
    AnalysisMethod.CRONBACH_ALPHA: MethodDefinition(
        method_key=AnalysisMethod.CRONBACH_ALPHA,
        method_name="Cronbach Alpha",
        description="Estimates internal consistency for a set of scale items.",
        required_variables=[
            "At least two ordinal, interval, or ratio variables intended as one scale."
        ],
        assumptions=[
            "Items reflect a common construct",
            "Items are coded in the same direction or reverse-scored",
            "Errors are not strongly correlated",
            "Tau-equivalence is considered when interpreting alpha as reliability",
        ],
        sample_size_guidance=(
            "Use enough participants for stable item covariance estimates; larger item sets "
            "and heterogeneous samples generally improve precision."
        ),
        advantages=[
            "Commonly reported internal-consistency estimate.",
            "Supports item-level diagnostics in later execution.",
        ],
        limitations=[
            "A high alpha does not prove unidimensionality.",
            "Alpha can increase merely by adding similar items.",
        ],
        alternatives=[AnalysisMethod.DESCRIPTIVE_STATISTICS],
    ),
}


def list_methods() -> list[MethodDefinition]:
    return list(METHODS.values())


def get_method(method_key: AnalysisMethod) -> MethodDefinition:
    return METHODS[method_key]

