import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  FileSpreadsheet,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: FileSpreadsheet,
    title: "Understand your data",
    copy: "Upload CSV or Excel files and turn raw columns into a clear variable dictionary.",
    color: "bg-brand-50 text-brand-600",
  },
  {
    icon: Lightbulb,
    title: "Clarify your design",
    copy: "Structure research questions, hypotheses, constructs, and study design in one guided flow.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: BarChart3,
    title: "Choose methods confidently",
    copy: "Receive transparent recommendations grounded in variable roles, scales, and research intent.",
    color: "bg-teal-50 text-teal-600",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper">
      <nav className="relative z-10 mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3.5 text-xl font-bold text-ink">
          <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-500 text-white shadow-sm">
            <BookOpenCheck className="size-6" />
          </span>
          StatMentor AI
        </Link>
      </nav>

      <section className="relative px-5 pb-9 pt-5 sm:px-8 sm:pb-10 sm:pt-7">
        <div className="absolute left-1/2 -top-20 -z-0 size-[540px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100/60 via-violet-50 to-teal-50 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-sm font-semibold text-brand-700 shadow-sm">
            <CheckCircle2 className="size-4" />
            Built for thoughtful, defensible doctoral research
          </div>
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Your statistical thinking partner,
            <span className="block bg-gradient-to-r from-brand-600 via-violet-600 to-teal-600 bg-clip-text text-transparent">
              from question to method.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            StatMentor AI helps doctoral researchers organize data, articulate study design,
            and choose appropriate statistical methods with transparent guidance.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open Dashboard
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, copy, color }) => (
            <Card key={title} className="p-5">
              <span className={`grid size-10 place-items-center rounded-xl ${color}`}>
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
