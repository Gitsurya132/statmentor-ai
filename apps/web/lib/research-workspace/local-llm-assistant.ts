import type {
  AssistantResponse,
  ResearchWorkspaceContext,
  ResearchWorkspaceService,
} from "@/lib/research-workspace/types";

export class LocalLLMResearchAssistant implements ResearchWorkspaceService {
  respond(
    question: string,
    context: ResearchWorkspaceContext,
  ): AssistantResponse {
    void question;
    void context;
    throw new Error("LocalLLMResearchAssistant is a future provider and is not enabled.");
  }
}
