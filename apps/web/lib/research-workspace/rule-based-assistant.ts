import type { Variable, VariableRole } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import type {
  AssistantResponse,
  ResearchWorkspaceContext,
  ResearchWorkspaceService,
} from "@/lib/research-workspace/types";

export class RuleBasedResearchAssistant implements ResearchWorkspaceService {
  respond(question: string, context: ResearchWorkspaceContext): AssistantResponse {
    const normalized = question.toLowerCase();

    if (!context.project) {
      return {
        title: "Choose a project first",
        body: "Open a project so I can use its datasets, variables, research design, and recommendations.",
      };
    }
    if (normalized.includes("hypoth")) return generateHypotheses(context);
    if (normalized.includes("research question")) return generateResearchQuestions(context);
    if (normalized.includes("recommend") || normalized.includes("statistical test")) {
      return explainRecommendation(context);
    }
    if (
      normalized.includes("independent") ||
      normalized.includes("dependent") ||
      normalized.includes("variable")
    ) {
      return explainVariables(context);
    }
    if (
      normalized.includes("nominal") ||
      normalized.includes("ordinal") ||
      normalized.includes("noir") ||
      normalized.includes("scale")
    ) {
      return explainNoir(context);
    }
    if (normalized.includes("design")) return explainDesign(context);
    if (
      normalized.includes("dataset") ||
      normalized.includes("structure") ||
      normalized.includes("interpret")
    ) {
      return explainDataset(context);
    }
    return {
      title: "Research workspace",
      body: "I can explain your variables, summarize the dataset, draft research questions and hypotheses, describe the research design, or explain the current statistical recommendation.",
      sections: [
        {
          heading: "Try asking",
          items: [
            "Which variable should be my dependent variable?",
            "Generate research questions",
            "Explain my dataset structure",
            "Recommend a statistical test",
          ],
        },
      ],
    };
  }
}

function explainVariables(context: ResearchWorkspaceContext): AssistantResponse {
  if (!context.variables.length) return noVariables();
  const byRole = groupByRole(context.variables);
  return {
    title: "Variable roles",
    body: "Based on the stored variable dictionary and rule-based classifications, these are the current research roles. Treat low-confidence or unclassified roles as prompts for review.",
    sections: Object.entries(byRole).map(([role, variables]) => ({
      heading: titleCase(role),
      items: variables.map(
        (variable) => `${variable.display_name} — ${variableExplanation(variable)}`,
      ),
    })),
  };
}

function explainNoir(context: ResearchWorkspaceContext): AssistantResponse {
  if (!context.variables.length) {
    return {
      title: "Nominal versus ordinal",
      body: "Nominal variables contain categories without an inherent order, such as department or gender. Ordinal variables contain ordered categories, such as satisfaction levels or rankings. Interval variables have equal spacing without a meaningful zero, while ratio variables also have a meaningful zero.",
    };
  }
  return {
    title: "NOIR scale explanation",
    body: "The current scale assignments come from local rules and saved researcher review.",
    sections: [
      {
        heading: "Your variables",
        items: context.variables.map((variable) => {
          const scale = getScale(variable);
          return `${variable.display_name}: ${titleCase(scale)} — ${scaleReason(scale)}`;
        }),
      },
    ],
  };
}

function explainDataset(context: ResearchWorkspaceContext): AssistantResponse {
  if (!context.datasets.length) {
    return {
      title: "No dataset uploaded",
      body: "Upload a CSV or Excel file to receive a dataset-aware explanation.",
    };
  }
  return {
    title: "Dataset structure",
    body: `This project contains ${context.datasets.length} dataset${context.datasets.length === 1 ? "" : "s"} and ${context.variables.length} variables in the latest available version.`,
    sections: context.datasets.map((dataset) => ({
      heading: dataset.name,
      items: [
        `${dataset.latest_version?.row_count ?? 0} rows`,
        `${dataset.latest_version?.column_count ?? 0} columns`,
        `Source format: ${dataset.source_format.toUpperCase()}`,
        `Version status: ${dataset.latest_version?.status ?? "unavailable"}`,
      ],
    })),
  };
}

function explainDesign(context: ResearchWorkspaceContext): AssistantResponse {
  if (!context.researchDesign) {
    return {
      title: "Research design not created",
      body: "Complete the Research Design Wizard to capture study type, questions, hypotheses, sample size, time structure, and study focus.",
    };
  }
  return {
    title: "Research design",
    body: context.researchDesign.summary,
    sections: [
      {
        heading: "Design details",
        items: [
          `Study type: ${titleCase(context.researchDesign.study_type)}`,
          `Time structure: ${titleCase(context.researchDesign.temporal_design)}`,
          `Study focus: ${titleCase(context.researchDesign.study_focus)}`,
          `Sample size: ${context.researchDesign.sample_size ?? "Not specified"}`,
          `Software preference: ${context.researchDesign.software_preference}`,
        ],
      },
    ],
  };
}

function generateResearchQuestions(context: ResearchWorkspaceContext): AssistantResponse {
  const constructs = getConstructs(context);
  if (constructs.length < 2) {
    return {
      title: "More constructs needed",
      body: "Classify variables or add key constructs in the Research Design Wizard so I can generate specific questions.",
    };
  }
  const outcome = getDependentVariable(context.variables)?.display_name ?? constructs.at(-1)!;
  const predictors = constructs.filter((construct) => construct !== outcome).slice(0, 2);
  return {
    title: "Possible research questions",
    body: "These prompts are generated locally from the available constructs and should be refined to match your theoretical framework.",
    sections: [
      {
        heading: "Generated questions",
        items: [
          `What relationship exists between ${predictors[0]} and ${outcome}?`,
          predictors[1]
            ? `How do ${predictors[0]} and ${predictors[1]} jointly predict ${outcome}?`
            : `To what extent does ${predictors[0]} predict ${outcome}?`,
          `How does ${outcome} vary across relevant participant or organizational groups?`,
        ],
      },
    ],
  };
}

function generateHypotheses(context: ResearchWorkspaceContext): AssistantResponse {
  const dependent = getDependentVariable(context.variables);
  const independent = context.variables.find(
    (variable) => getRole(variable) === "independent_variable",
  );
  if (!dependent || !independent) {
    return {
      title: "Classify variables first",
      body: "Assign at least one independent variable and one dependent variable before generating specific hypotheses.",
    };
  }
  return {
    title: "Generated hypotheses",
    body: "These are neutral templates generated from the current variable roles. Directional language should be supported by theory or prior research.",
    sections: [
      {
        heading: "Null hypothesis (H0)",
        items: [
          `${independent.display_name} has no statistically significant relationship with ${dependent.display_name}.`,
        ],
      },
      {
        heading: "Alternative hypothesis (H1)",
        items: [
          `${independent.display_name} has a statistically significant relationship with ${dependent.display_name}.`,
        ],
      },
    ],
  };
}

function explainRecommendation(context: ResearchWorkspaceContext): AssistantResponse {
  const recommendation = context.recommendation?.recommendations[0];
  if (!recommendation) {
    return {
      title: "No recommendation yet",
      body: "Complete the Research Design Wizard, confirm variable roles and scales, then run the Test Recommendation workspace.",
    };
  }
  const dependent = getDependentVariable(context.variables);
  const predictors = context.variables.filter((variable) =>
    ["independent_variable", "control_variable", "confounding_variable"].includes(
      getRole(variable),
    ),
  );
  return {
    title: recommendation.method_name,
    body: recommendation.why_recommended,
    sections: [
      {
        heading: "Model roles",
        items: [
          `Dependent variable: ${dependent?.display_name ?? "Not identified"}`,
          `Predictors: ${predictors.map((variable) => variable.display_name).join(", ") || "Not identified"}`,
        ],
      },
      { heading: "Key assumptions", items: recommendation.assumptions.slice(0, 4) },
      { heading: "Limitations", items: recommendation.limitations.slice(0, 3) },
    ],
  };
}

function groupByRole(variables: Variable[]) {
  return variables.reduce<Record<string, Variable[]>>((groups, variable) => {
    const role = getRole(variable);
    groups[role] = [...(groups[role] ?? []), variable];
    return groups;
  }, {});
}

function getRole(variable: Variable): VariableRole {
  const classification = variable.profile.classification as { role?: VariableRole } | undefined;
  return classification?.role ?? "other";
}

function getScale(variable: Variable) {
  const detection = variable.profile.scale_detection as { scale_type?: string } | undefined;
  return detection?.scale_type ?? variable.measurement_level;
}

function getDependentVariable(variables: Variable[]) {
  return variables.find((variable) => getRole(variable) === "dependent_variable");
}

function getConstructs(context: ResearchWorkspaceContext) {
  const designConstructs = context.researchDesign?.key_constructs ?? [];
  return designConstructs.length
    ? designConstructs
    : context.variables.map((variable) => variable.display_name);
}

function variableExplanation(variable: Variable) {
  const scale = getScale(variable);
  const role = titleCase(getRole(variable));
  return `${titleCase(variable.data_type)} variable, ${titleCase(scale)} scale, currently assigned as ${role}.`;
}

function scaleReason(scale: string) {
  const reasons: Record<string, string> = {
    nominal: "Categories have no natural ordering.",
    ordinal: "Categories have a meaningful order, but intervals are not assumed equal.",
    interval: "Values have equal intervals without a meaningful absolute zero.",
    ratio: "Values have equal intervals and a meaningful zero.",
    scale: "The database stores interval and ratio variables under the broader scale level.",
  };
  return reasons[scale] ?? "This scale should be reviewed using domain knowledge.";
}

function noVariables(): AssistantResponse {
  return {
    title: "No variables available",
    body: "Upload a dataset and run variable classification to receive dataset-aware explanations.",
  };
}
