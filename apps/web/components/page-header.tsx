import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
