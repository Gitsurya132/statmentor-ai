import type {
  AssistantResponse,
  ResearchWorkspaceContext,
  ResearchWorkspaceService,
} from "@/lib/research-workspace/types";

export class OpenAIResearchAssistant implements ResearchWorkspaceService {
  respond(
    question: string,
    context: ResearchWorkspaceContext,
  ): AssistantResponse {
    void question;
    void context;
    throw new Error("OpenAIResearchAssistant is a future provider and is not enabled.");
  }
}
