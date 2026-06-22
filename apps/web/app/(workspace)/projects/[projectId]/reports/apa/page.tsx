import { BookOpenCheck, Download, FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { titleCase } from "@/lib/utils";

export default async function ApaPlaceholderPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  const { method = "recommended_method" } = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="APA reporting"
        title="Results narrative preview"
        description="A structured placeholder for the future traceable APA 7 report generated from verified analysis results."
        action={<Badge className="bg-violet-50 text-violet-600">APA 7</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
        <Card className="h-fit p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <BookOpenCheck className="size-5" />
          </span>
          <h2 className="mt-5 font-bold text-ink">Report outline</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            {["Analysis overview", "Assumption checks", "Primary findings", "APA table", "Interpretive notes"].map(
              (item, index) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-bold">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ),
            )}
          </ol>
          <Button className="mt-7 w-full" disabled>
            <Download className="size-4" />
            DOCX export coming soon
          </Button>
        </Card>
        <Card className="p-7 sm:p-10">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <FileText className="size-5 text-brand-600" />
            <div>
              <p className="font-bold text-ink">Results</p>
              <p className="text-xs text-slate-400">{titleCase(method)}</p>
            </div>
          </div>
          <div className="mt-7 space-y-5 font-serif text-[17px] leading-8 text-slate-700">
            <p>
              A {titleCase(method).toLowerCase()} analysis will be conducted to address the
              stated research question. Prior to interpretation, relevant assumptions will be
              evaluated and any material violations will be reported.
            </p>
            <p>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-sans text-sm font-semibold text-amber-800">
                Placeholder
              </span>{" "}
              Verified test statistics, degrees of freedom, exact <em>p</em> values, confidence
              intervals, and effect sizes will appear here after the statistical execution module
              is implemented.
            </p>
          </div>
          <div className="mt-8 rounded-xl bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Traceability</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Future numeric statements will be linked to an immutable analysis result rather than
              generated from language-model memory.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
