"use client";

import { useEffect } from "react";

import { setActiveProjectId } from "@/lib/workspace-state";

export function ActiveProjectTracker({ projectId }: { projectId: string }) {
  useEffect(() => {
    setActiveProjectId(projectId);
  }, [projectId]);

  return null;
}
