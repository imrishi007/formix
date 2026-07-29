"use client";

/**
 * components/workspace/top-bar.tsx
 * Global nav for the authoring workspace: brand, project switcher, active
 * form breadcrumb, Formix AI toggle, run/publish/submissions actions, user menu.
 */

import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Play, CheckCircle2, AlertCircle, Globe, Inbox, LayoutDashboard, LogOut, Sparkles, User as UserIcon } from "lucide-react";
import type { ProjectResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CompilePhase = "idle" | "parsing" | "semantic" | "valid" | "error";
export type PublishState = "idle" | "publishing" | "done" | "error";
export type SaveState = "idle" | "saving" | "saved" | "error";

export function TopBar({
  projects,
  activeProjectId,
  activeFormTitle,
  onSelectProject,
  compilePhase,
  saveState,
  wasmReady,
  onManualCompile,
  onPublish,
  publishState,
  onOpenSubmissions,
  canPublish,
  aiOpen,
  onToggleAi,
}: {
  projects: ProjectResponse[];
  activeProjectId: string | null;
  activeFormTitle: string | null;
  onSelectProject: (id: string) => void;
  compilePhase: CompilePhase;
  saveState: SaveState;
  wasmReady: boolean;
  onManualCompile: () => void;
  onPublish: () => void;
  publishState: PublishState;
  onOpenSubmissions: () => void;
  canPublish: boolean;
  aiOpen: boolean;
  onToggleAi: () => void;
}) {
  const { user, logout } = useAuth();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const phase: Record<CompilePhase, { label: string; dot: string; icon: React.ReactNode; tone: string }> = {
    idle:     { label: wasmReady ? "Ready" : "Loading…", dot: wasmReady ? "bg-success" : "bg-warning animate-pulse", icon: null, tone: "text-muted-foreground" },
    parsing:  { label: "Parsing…",  dot: "bg-warning animate-pulse", icon: null, tone: "text-muted-foreground" },
    semantic: { label: "Analyzing…", dot: "bg-warning animate-pulse", icon: null, tone: "text-muted-foreground" },
    valid:    { label: "Compiled",  dot: "bg-accent", icon: <CheckCircle2 className="h-3 w-3" />, tone: "text-accent" },
    error:    { label: "Error",     dot: "bg-destructive", icon: <AlertCircle className="h-3 w-3" />, tone: "text-destructive" },
  };
  const status = phase[compilePhase];

  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex flex-none items-center gap-2 rounded-md px-1 py-1 transition-opacity hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
            <span className="font-inter text-[10px] font-black tracking-tighter text-accent">FX</span>
          </div>
          <span className="hidden font-inter text-sm font-semibold tracking-tight text-foreground sm:inline">Formix</span>
        </Link>

        <span className="h-4 w-px flex-none bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 font-inter text-sm text-foreground transition-colors hover:bg-accent/10"
            >
              <span className="truncate">{activeProject?.title ?? "Select project"}</span>
              <ChevronDown className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuLabel>Your projects</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projects.length === 0 && (
              <div className="px-2 py-1.5 font-inter text-sm text-muted-foreground">No projects yet</div>
            )}
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onSelectProject(p.id)}>
                {p.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFormTitle && (
          <div className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground/50" />
            <span className="truncate rounded-md bg-muted px-2 py-1 font-inter text-sm text-foreground">{activeFormTitle}</span>
          </div>
        )}
      </div>

      <div className="flex flex-none items-center gap-2">
        {saveState === "saving" && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {saveState === "saved" && (
          <span className="font-mono text-xs text-muted-foreground/80">Saved</span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-destructive" title="Your last edit failed to save — check your connection and keep editing to retry.">
            <AlertCircle className="h-3 w-3" /> Save failed
          </span>
        )}

        <div className={`flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 ${status.tone}`}>
          {status.icon ?? <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />}
          <span className="font-inter text-xs font-medium">{status.label}</span>
        </div>

        <Button
          variant={aiOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleAi}
          className={aiOpen ? "" : "border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"}
        >
          <Sparkles className="h-3.5 w-3.5" /> Formix AI
        </Button>

        <Button variant="outline" size="sm" onClick={onManualCompile} disabled={!wasmReady}>
          <Play className="h-3.5 w-3.5" /> Run
        </Button>

        <Button variant="ghost" size="sm" onClick={onOpenSubmissions}>
          <Inbox className="h-3.5 w-3.5" /> Submissions
        </Button>

        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </Button>

        <Button
          size="sm"
          onClick={onPublish}
          disabled={!canPublish || publishState === "publishing"}
          title={!canPublish ? "Fix compile errors before publishing" : "Publish form"}
        >
          {publishState === "publishing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          {publishState === "publishing" ? "Publishing…" : "Publish"}
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account menu — signed in as ${user?.email ?? "unknown"}`}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent/15 text-accent transition-colors hover:bg-accent/25"
            >
              <UserIcon className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-3.5 w-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
