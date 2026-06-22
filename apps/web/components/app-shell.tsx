"use client";

import {
  BookOpenCheck,
  Database,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ResearchWorkspaceDrawer } from "@/components/research-workspace-drawer";
import {
  getActiveProjectId,
  WORKSPACE_STATE_EVENT,
} from "@/lib/workspace-state";

export function AppShell({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProject] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const projectId = getActiveProjectId();
      setActiveProject(projectId);
    };
    sync();
    window.addEventListener(WORKSPACE_STATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WORKSPACE_STATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const navigation = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    {
      href: activeProjectId
        ? `/projects/${activeProjectId}/datasets/upload`
        : "/projects?notice=select-project&action=upload",
      label: "Upload Dataset",
      icon: Upload,
      requiresProject: true,
    },
    {
      href: "/datasets",
      label: "View Datasets",
      icon: Database,
    },
    {
      href: "/analysis-workflow",
      label: "Analysis Workflow",
      icon: FlaskConical,
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-bold text-ink">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-500 text-white">
              <BookOpenCheck className="size-5" />
            </span>
            <span className="hidden xl:inline">StatMentor AI</span>
          </Link>
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {navigation.map(({ href, label, icon: Icon, requiresProject }) => (
              <Link
                key={label}
                href={href}
                title={
                  requiresProject && !activeProjectId
                    ? `Select a project before using ${label}`
                    : label
                }
                className="flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink"
              >
                <Icon className="size-4" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <button
        type="button"
        onClick={() => setWorkspaceOpen((current) => !current)}
        aria-label={`${workspaceOpen ? "Close" : "Open"} Research Workspace`}
        aria-expanded={workspaceOpen}
        title={`${workspaceOpen ? "Close" : "Open"} Research Workspace`}
        className="group fixed bottom-5 right-5 z-[60] grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-brand-600 text-white shadow-[0_14px_36px_-10px_rgba(14,116,144,0.65)] transition duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_18px_42px_-10px_rgba(14,116,144,0.75)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:bottom-7 sm:right-7"
      >
        <span className="absolute inset-0 rounded-2xl bg-white/0 transition group-hover:bg-white/10" />
        <Sparkles
          className={`relative size-6 transition-transform duration-200 ${
            workspaceOpen ? "rotate-12 scale-110" : "group-hover:rotate-12"
          }`}
        />
      </button>
      <ResearchWorkspaceDrawer
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        activeProjectId={activeProjectId}
      />
    </div>
  );
}
