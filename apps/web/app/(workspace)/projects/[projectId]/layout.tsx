import type { ReactNode } from "react";

import { ActiveProjectTracker } from "@/components/active-project-tracker";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <ActiveProjectTracker projectId={projectId} />
      {children}
    </>
  );
}
