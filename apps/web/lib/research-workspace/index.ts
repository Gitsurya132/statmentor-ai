import { RuleBasedResearchAssistant } from "@/lib/research-workspace/rule-based-assistant";
import type { ResearchWorkspaceService } from "@/lib/research-workspace/types";

export type {
  AssistantResponse,
  ResearchWorkspaceContext,
  ResearchWorkspaceService,
} from "@/lib/research-workspace/types";

export const researchWorkspaceService: ResearchWorkspaceService =
  new RuleBasedResearchAssistant();
