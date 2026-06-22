import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <Inbox className="size-6" />
        </span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}
