import type {
  DatasetDetail,
  Project,
  ResearchDesign,
  TestRecommendationResponse,
  Variable,
} from "@/lib/types";

export interface ResearchWorkspaceContext {
  project: Project | null;
  datasets: DatasetDetail[];
  variables: Variable[];
  researchDesign: ResearchDesign | null;
  recommendation: TestRecommendationResponse | null;
}

export interface AssistantResponse {
  title: string;
  body: string;
  sections?: { heading: string; items: string[] }[];
}

export interface ResearchWorkspaceService {
  respond(question: string, context: ResearchWorkspaceContext): AssistantResponse;
}
