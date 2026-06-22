import type {
  ScaleType,
  TestRecommendationResponse,
  VariableRole,
} from "@/lib/types";

const ACTIVE_PROJECT_KEY = "statmentor.activeProjectId";
const DESIGN_KEY_PREFIX = "statmentor.design.";
const RECOMMENDATION_KEY_PREFIX = "statmentor.recommendation.";
const ANALYSIS_KEY_PREFIX = "statmentor.analysis.";
export const WORKSPACE_STATE_EVENT = "statmentor-workspace-state";

export interface AnalysisWorkflowState {
  dataset_version_id: string;
  selected_method_key: string | null;
  selected_variables?: {
    variable_id: string;
    source_name: string;
    display_name: string;
    role: VariableRole;
    scale_type: ScaleType;
  }[];
  analysis_run: boolean;
  results_interpreted: boolean;
  apa_report_generated: boolean;
}

function notify() {
  window.dispatchEvent(new Event(WORKSPACE_STATE_EVENT));
}

export function getActiveProjectId() {
  return typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(projectId: string) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  notify();
}

export function getResearchDesignId(projectId: string) {
  return localStorage.getItem(`${DESIGN_KEY_PREFIX}${projectId}`);
}

export function setResearchDesignId(projectId: string, designId: string) {
  localStorage.setItem(`${DESIGN_KEY_PREFIX}${projectId}`, designId);
  notify();
}

export function getRecommendation(projectId: string): TestRecommendationResponse | null {
  const raw = localStorage.getItem(`${RECOMMENDATION_KEY_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TestRecommendationResponse;
  } catch {
    return null;
  }
}

export function setRecommendation(
  projectId: string,
  recommendation: TestRecommendationResponse,
) {
  localStorage.setItem(
    `${RECOMMENDATION_KEY_PREFIX}${projectId}`,
    JSON.stringify(recommendation),
  );
  notify();
}

export function getAnalysisWorkflowState(
  projectId: string,
): AnalysisWorkflowState | null {
  const raw = localStorage.getItem(`${ANALYSIS_KEY_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalysisWorkflowState;
  } catch {
    return null;
  }
}

export function setAnalysisWorkflowState(
  projectId: string,
  state: AnalysisWorkflowState,
) {
  localStorage.setItem(`${ANALYSIS_KEY_PREFIX}${projectId}`, JSON.stringify(state));
  notify();
}
