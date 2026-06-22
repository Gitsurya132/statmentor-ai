"use client";

import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { api } from "@/lib/api";
import {
  researchWorkspaceService,
  type AssistantResponse,
  type ResearchWorkspaceContext,
} from "@/lib/research-workspace";
import { getRecommendation, getResearchDesignId } from "@/lib/workspace-state";

const suggestedQuestions = [
  "Explain my variables",
  "Identify independent and dependent variables",
  "Recommend a statistical test",
  "Generate research questions",
  "Generate hypotheses",
  "Explain Nominal vs Ordinal variables",
  "Explain my dataset structure",
  "Suggest a research design",
  "Interpret my dataset",
];

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; response: AssistantResponse };

const emptyContext: ResearchWorkspaceContext = {
  project: null,
  datasets: [],
  variables: [],
  researchDesign: null,
  recommendation: null,
};

export function ResearchWorkspaceDrawer({
  open,
  onClose,
  activeProjectId,
}: {
  open: boolean;
  onClose: () => void;
  activeProjectId: string | null;
}) {
  const [context, setContext] = useState<ResearchWorkspaceContext>(emptyContext);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const contextLabel = useMemo(
    () => context.project?.title ?? "No active project",
    [context.project],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadContext() {
      if (!activeProjectId) {
        setContext(emptyContext);
        return;
      }
      setLoading(true);
      try {
        const [project, datasetList] = await Promise.all([
          api.projects.get(activeProjectId),
          api.datasets.list(activeProjectId),
        ]);
        const datasets = await Promise.all(
          datasetList.items.map((dataset) => api.datasets.get(dataset.id)),
        );
        const versionIds = datasets
          .map((dataset) => dataset.latest_version?.id)
          .filter((id): id is string => Boolean(id));
        const variableGroups = await Promise.all(
          versionIds.map((versionId) => api.datasets.variables(versionId)),
        );
        const designId = getResearchDesignId(activeProjectId);
        const researchDesign = designId
          ? await api.researchDesigns.get(designId).catch(() => null)
          : null;
        if (active) {
          setContext({
            project,
            datasets,
            variables: variableGroups.flat(),
            researchDesign,
            recommendation: getRecommendation(activeProjectId),
          });
        }
      } catch {
        if (active) setContext(emptyContext);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadContext();
    return () => {
      active = false;
    };
  }, [activeProjectId, open]);

  function ask(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const response = researchWorkspaceService.respond(trimmed, context);
    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
      { role: "assistant", response },
    ]);
    setQuestion("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close Research Workspace"
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-brand-600 text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Research Workspace</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ask questions about your dataset, variables, research design, and statistical
                methods.
              </p>
              <p className="mt-1 text-xs font-semibold text-teal-600">{contextLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin text-brand-600" />
              Loading project context…
            </div>
          ) : messages.length ? (
            <div className="space-y-5">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white">
                    {message.text}
                  </div>
                ) : (
                  <AssistantMessage key={index} response={message.response} />
                ),
              )}
            </div>
          ) : (
            <div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex gap-3">
                  <Bot className="mt-0.5 size-5 shrink-0 text-teal-600" />
                  <p className="text-sm leading-6 text-slate-600">
                    I use local rule-based logic and your saved project metadata. No external AI
                    API, tokens, or cloud inference are used.
                  </p>
                </div>
              </div>
              <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
                Suggested questions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(question);
                }
              }}
              placeholder="Ask a research question..."
              className="min-h-12 resize-none bg-white"
            />
            <Button
              type="button"
              onClick={() => ask(question)}
              disabled={!question.trim()}
              aria-label="Ask"
              className="size-11 shrink-0 px-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AssistantMessage({ response }: { response: AssistantResponse }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 p-4">
      <div className="flex gap-3">
        <Bot className="mt-0.5 size-5 shrink-0 text-teal-600" />
        <div className="min-w-0">
          <h3 className="font-bold text-ink">{response.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{response.body}</p>
          {response.sections?.map((section) => (
            <div key={section.heading} className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {section.heading}
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
