"use client";

import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api";
import { setResearchDesignId } from "@/lib/workspace-state";

export function ResearchDesignForm({ projectId }: { projectId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [designId, setDesignId] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    setSummary("");
    try {
      const splitLines = (name: string) =>
        String(formData.get(name) || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
      const splitComma = (name: string) =>
        String(formData.get(name) || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      const rawSampleSize = String(formData.get("sample_size") || "").trim();
      const design = await api.researchDesigns.create(projectId, {
        study_type: formData.get("study_type"),
        research_questions: splitLines("research_questions"),
        hypotheses: splitLines("hypotheses"),
        sample_size: rawSampleSize ? Number(rawSampleSize) : null,
        temporal_design: formData.get("temporal_design"),
        study_focus: formData.get("study_focus"),
        software_preference: formData.get("software_preference"),
        key_constructs: splitComma("key_constructs"),
      });
      setDesignId(design.id);
      setResearchDesignId(projectId, design.id);
      const generated = await api.researchDesigns.summary(design.id);
      setSummary(generated.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the research design.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="p-6 sm:p-8">
        <form action={submit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Study type">
              <Select name="study_type" defaultValue="quantitative">
                <option value="quantitative">Quantitative</option>
                <option value="qualitative">Qualitative</option>
                <option value="mixed_methods">Mixed methods</option>
              </Select>
            </Field>
            <Field label="Sample size">
              <Input name="sample_size" type="number" min={1} placeholder="250" />
            </Field>
          </div>
          <Field label="Research questions" hint="One question per line">
            <Textarea
              name="research_questions"
              required
              placeholder="How is transformational leadership related to employee engagement?"
            />
          </Field>
          <Field label="Hypotheses" hint="One hypothesis per line">
            <Textarea
              name="hypotheses"
              placeholder="Transformational leadership is positively related to engagement."
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Time structure">
              <Select name="temporal_design" defaultValue="cross_sectional">
                <option value="cross_sectional">Cross-sectional</option>
                <option value="longitudinal">Longitudinal</option>
              </Select>
            </Field>
            <Field label="Study focus">
              <Select name="study_focus" defaultValue="relationship">
                <option value="relationship">Relationship</option>
                <option value="comparison">Comparison</option>
                <option value="both">Both</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Software preference">
              <Input name="software_preference" required defaultValue="Python" />
            </Field>
            <Field label="Key constructs" hint="Separate with commas">
              <Input
                name="key_constructs"
                placeholder="leadership, culture, engagement, performance"
              />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate research design
          </Button>
        </form>
      </Card>

      <Card className="h-fit border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-white text-violet-600 shadow-sm">
          {summary ? <CheckCircle2 className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <h2 className="mt-5 text-lg font-bold text-ink">Research design summary</h2>
        {summary ? (
          <>
            <p className="mt-4 font-serif text-lg leading-8 text-slate-700">{summary}</p>
            <p className="mt-5 break-all font-mono text-xs text-slate-400">
              Design ID: {designId}
            </p>
            <Button asChild className="mt-5">
              <Link href={`/projects/${projectId}/recommendations?designId=${designId}`}>
                Get test recommendation
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Complete the wizard and StatMentor will generate a concise description of your study.
          </p>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint ? <span className="mb-2 text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
