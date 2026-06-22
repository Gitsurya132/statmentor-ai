"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      const project = await api.projects.create({
        title: String(formData.get("title")),
        description: String(formData.get("description") || ""),
        research_context: { discipline: String(formData.get("discipline") || "") },
      });
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the project.");
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl p-6 sm:p-8">
      <form action={submit} className="space-y-6">
        <div>
          <Label htmlFor="title">Project title</Label>
          <Input id="title" name="title" required maxLength={250} placeholder="Dissertation Study" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="A short description of the study purpose and context."
          />
        </div>
        <div>
          <Label htmlFor="discipline">Discipline or research area</Label>
          <Input
            id="discipline"
            name="discipline"
            placeholder="Education, psychology, organizational leadership…"
          />
          <p className="mt-2 text-xs text-slate-500">
            This is stored in the project research context.
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create project
          {!pending ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </Card>
  );
}
