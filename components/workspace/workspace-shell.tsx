"use client";

/**
 * components/workspace/workspace-shell.tsx
 *
 * Replaces components/editor/demo-ide-shell.tsx. Composes the global nav,
 * a real-backend Project Explorer, the Monaco editor pane, the live preview,
 * and the diagnostics panel. Forms are real backend records (Project/Form
 * tables) fetched via lib/api.ts — no more in-memory virtual file system.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, Files, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getProjects,
  getProject,
  createProject,
  deleteProject,
  createFormInProject,
  getFormDetail,
  deleteForm,
  updateForm,
  publishForm,
  getResponses,
  deleteAllResponses,
  ApiError,
  type ProjectResponse,
  type ProjectDetail,
} from "@/lib/api";
import { useFormlCompiler, type FormlCompileResult } from "@/lib/use-forml-compiler";
import { newFormlTemplate } from "@/lib/forml-file-system";
import type { ASTNode } from "@/components/form-renderer";

import { TopBar, type CompilePhase, type PublishState, type SaveState } from "@/components/workspace/top-bar";
import { ProjectExplorer } from "@/components/workspace/project-explorer";
import { EditorPane, type EditorControl } from "@/components/workspace/editor-pane";
import { PreviewPane } from "@/components/workspace/preview-pane";
import { DiagnosticsPanel, type ConsoleLogEntry } from "@/components/workspace/diagnostics-panel";
import { PublishDialog } from "@/components/workspace/publish-dialog";
import { SubmissionsPanel } from "@/components/workspace/submissions-panel";
import { AiPanel } from "@/components/workspace/ai-panel";
import { RenameSuggestion } from "@/components/workspace/rename-suggestion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface CursorState { line: number; column: number; }

/** Consistent, user-facing message for any thrown value — ApiError carries
 *  the backend's own detail string, everything else (network errors already
 *  become ApiError in lib/api.ts, so this really only covers programmer
 *  errors) falls back to a generic message instead of leaking `[object
 *  Object]` or a raw stack trace into a toast. */
function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export function WorkspaceShell() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { ready: wasmReady, compile } = useFormlCompiler();

  // ── Redirect to sign-in if not authenticated ────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  // ── Projects / forms (real backend) ─────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [projectDetails, setProjectDetails] = useState<Map<string, ProjectDetail>>(new Map());
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [activeFormTitle, setActiveFormTitle] = useState<string | null>(null);

  const [source, setSource] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // ── Smart form detection: suggest (never force) a rename when the DSL's
  // `form "Title"` no longer matches the form's stored title ─────────────────
  const [renameSuggestion, setRenameSuggestion] = useState<string | null>(null);
  const activeFormTitleRef = useRef<string | null>(null);
  useEffect(() => { activeFormTitleRef.current = activeFormTitle; }, [activeFormTitle]);
  // The exact detected title the author last dismissed via "Keep Current" —
  // suppresses re-nagging for that same value until it changes again.
  const dismissedTitleRef = useRef<string | null>(null);
  const detectTimerRef = useRef<number | null>(null);

  const detectFormTitle = useCallback((src: string): string | null => {
    const match = src.match(/form\s+"([^"]+)"/);
    const title = match?.[1]?.trim();
    return title && title.length > 0 ? title : null;
  }, []);

  const scheduleTitleDetection = useCallback((value: string) => {
    if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
    detectTimerRef.current = window.setTimeout(() => {
      const detected = detectFormTitle(value);
      if (!detected) return;
      const current = activeFormTitleRef.current;
      if (current && detected.toLowerCase() === current.trim().toLowerCase()) {
        setRenameSuggestion(null);
        return;
      }
      if (dismissedTitleRef.current?.toLowerCase() === detected.toLowerCase()) return;
      setRenameSuggestion(detected);
    }, 1200);
  }, [detectFormTitle]);

  const reloadProjectDetail = useCallback(async (projectId: string) => {
    const detail = await getProject(projectId);
    setProjectDetails((prev) => new Map(prev).set(projectId, detail));
    return detail;
  }, []);

  // ── Compile pipeline (same choreography as the old demo-ide-shell) ──────────
  const [compilePhase, setCompilePhase] = useState<CompilePhase>("idle");
  const [compileResult, setCompileResult] = useState<FormlCompileResult | null>(null);
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const [cursor, setCursor] = useState<CursorState>({ line: 1, column: 1 });
  const [diagOpen, setDiagOpen] = useState(false);
  const [explorerOpen] = useState(true);
  const phaseTimers = useRef<number[]>([]);
  const explorerPanelRef = useRef<ImperativePanelHandle | null>(null);
  const diagPanelRef = useRef<ImperativePanelHandle | null>(null);

  // ── Formix AI panel ──────────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const aiPanelRef = useRef<ImperativePanelHandle | null>(null);
  const editorControlRef = useRef<EditorControl>({ setValue: () => {} });

  // Landing page's "Talk to AI" CTA links to /editor/demo?ai=1 — open the
  // panel automatically so that promise is immediately true, without
  // touching routing (read directly off the URL, not a Next.js data hook).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ai") === "1") {
      setAiOpen(true);
    }
  }, []);

  const handleApplyToEditor = useCallback((code: string) => {
    editorControlRef.current.setValue(code);
  }, []);
  // Latest source, readable from effects/callbacks without adding `source`
  // as a dependency (which would recompile on every keystroke).
  const sourceRef = useRef("");
  // Latest wasmReady, read inside runCompile instead of closing over the
  // `wasmReady` render value — handleSelectForm is captured once (at mount)
  // inside the initial-projects-load effect below, so by the time its async
  // .then() resolves and calls runCompile, that closure's `wasmReady` may
  // still be stale (false) even though the compiler has since become ready.
  // A ref sidesteps the staleness because every closure shares the same
  // mutable object.
  const wasmReadyRef = useRef(wasmReady);
  useEffect(() => { wasmReadyRef.current = wasmReady; }, [wasmReady]);

  const [compileLog, setCompileLog] = useState<ConsoleLogEntry[]>([]);
  const logIdRef = useRef(0);
  const appendLog = useCallback((entry: { level: ConsoleLogEntry["level"]; message: string }) => {
    setCompileLog((prev) => {
      const next = [...prev, { id: logIdRef.current++, ts: new Date().toLocaleTimeString(), ...entry }];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach((id) => window.clearTimeout(id));
    phaseTimers.current = [];
  }, []);

  const runCompile = useCallback((src: string) => {
    if (!wasmReadyRef.current) return;
    clearPhaseTimers();
    setCompilePhase("parsing");
    const t1 = window.setTimeout(() => setCompilePhase("semantic"), 120);
    const t2 = window.setTimeout(() => {
      const result = compile(src);
      setCompileResult(result);
      setCompilePhase(result.ok ? "valid" : "error");
      setCompileMs(result.durationMs);
      const errCount = result.diagnostics.filter((d) => d.severity === "error").length;
      const warnCount = result.diagnostics.filter((d) => d.severity === "warning").length;
      appendLog(
        result.ok
          ? { level: "success", message: `Compiled in ${result.durationMs}ms` }
          : { level: "error", message: `Compile failed — ${errCount} error(s), ${warnCount} warning(s)` },
      );
      if (!result.ok && result.diagnostics.some((d) => d.severity === "error")) setDiagOpen(true);
    }, 280);
    phaseTimers.current = [t1, t2];
  }, [compile, clearPhaseTimers, appendLog]);

  // Re-run once WASM finishes loading after a form is already selected —
  // reads sourceRef instead of `source` so this doesn't fire on every keystroke.
  useEffect(() => {
    if (activeFormId && wasmReady) runCompile(sourceRef.current);
    return clearPhaseTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasmReady]);

  useEffect(() => {
    if (!activeFormId) { setCompilePhase("idle"); setCompileResult(null); }
  }, [activeFormId]);

  // Initial load: fetch projects, auto-select the first one.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingProjects(true);
    getProjects()
      .then(async (list) => {
        if (cancelled) return;
        setProjects(list);
        if (list.length > 0) {
          setActiveProjectId(list[0].id);
          const detail = await reloadProjectDetail(list[0].id);
          if (!cancelled && detail.forms.length > 0) {
            handleSelectForm(list[0].id, detail.forms[0].id, detail.forms[0].title);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(`Couldn't load your projects — ${describeError(err)}`);
      })
      .finally(() => { if (!cancelled) setLoadingProjects(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSelectProject = useCallback(async (projectId: string) => {
    setActiveProjectId(projectId);
    if (projectDetails.has(projectId)) return;
    try {
      await reloadProjectDetail(projectId);
    } catch (err) {
      toast.error(`Couldn't open that project — ${describeError(err)}`);
    }
  }, [projectDetails, reloadProjectDetail]);

  const handleSelectForm = useCallback(async (projectId: string, formId: string, titleHint?: string) => {
    setActiveProjectId(projectId);
    setActiveFormId(formId);
    setActiveFormTitle(titleHint ?? null);
    // A suggestion for the previous form has no bearing on the one we're
    // about to open — clear it rather than let it linger across forms.
    if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
    setRenameSuggestion(null);
    dismissedTitleRef.current = null;
    try {
      const detail = await getFormDetail(projectId, formId);
      sourceRef.current = detail.forml_source;
      setSource(detail.forml_source);
      setActiveFormTitle(detail.title);
      runCompile(detail.forml_source);
    } catch (err) {
      const message = describeError(err);
      appendLog({ level: "error", message: `Failed to load form: ${message}` });
      toast.error(`Couldn't load that form — ${message}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runCompile]);

  const handleCreateProject = useCallback(async (title: string) => {
    try {
      const project = await createProject(title);
      setProjects((prev) => [project, ...prev]);
      await handleSelectProject(project.id);
    } catch (err) {
      toast.error(`Couldn't create the project — ${describeError(err)}`);
      throw err; // let the dialog know so it stays open for a retry
    }
  }, [handleSelectProject]);

  const handleCreateForm = useCallback(async (projectId: string, title: string) => {
    try {
      const created = await createFormInProject(projectId, {
        title,
        forml_source: newFormlTemplate(title),
      });
      await reloadProjectDetail(projectId);
      await handleSelectForm(projectId, created.id, created.title);
    } catch (err) {
      toast.error(`Couldn't create the form — ${describeError(err)}`);
      throw err;
    }
  }, [reloadProjectDetail, handleSelectForm]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectDetails((prev) => { const next = new Map(prev); next.delete(projectId); return next; });
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        setActiveFormId(null);
        setActiveFormTitle(null);
        setSource("");
        sourceRef.current = "";
      }
    } catch (err) {
      toast.error(`Couldn't delete the project — ${describeError(err)}`);
    }
  }, [activeProjectId]);

  const handleDeleteForm = useCallback(async (projectId: string, formId: string) => {
    try {
      await deleteForm(projectId, formId);
      await reloadProjectDetail(projectId);
      if (activeFormId === formId) {
        setActiveFormId(null);
        setActiveFormTitle(null);
        setSource("");
        sourceRef.current = "";
      }
    } catch (err) {
      toast.error(`Couldn't delete the form — ${describeError(err)}`);
    }
  }, [activeFormId, reloadProjectDetail]);

  // ── Editing: debounced compile + debounced backend save ─────────────────────
  const compileTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const handleContentChange = useCallback((value: string) => {
    setSource(value);
    sourceRef.current = value;
    if (!activeFormId) return;

    if (compileTimerRef.current) window.clearTimeout(compileTimerRef.current);
    compileTimerRef.current = window.setTimeout(() => runCompile(value), 500);

    scheduleTitleDetection(value);

    setSaveState("saving");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const result = compile(value);
      try {
        await updateForm(activeFormId, {
          forml_source: value,
          compiled_schema: result.ok ? result.ast ?? undefined : undefined,
        });
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        const message = describeError(err);
        appendLog({ level: "error", message: `Save failed: ${message}` });
        toast.error(`Couldn't save your changes — ${message}`);
      }
    }, 800);
  }, [activeFormId, compile, runCompile, appendLog, scheduleTitleDetection]);

  const manualCompileHandlerRef = useRef(() => {});
  manualCompileHandlerRef.current = useCallback(() => {
    if (activeFormId) runCompile(source);
  }, [activeFormId, runCompile, source]);

  // ── Rename confirmation (only shown when the form already has submissions) ──
  const [renameConfirm, setRenameConfirm] = useState<{ formId: string; title: string; count: number } | null>(null);
  const [renamingBusy, setRenamingBusy] = useState(false);

  const applyRename = useCallback(async (formId: string, newTitle: string) => {
    await updateForm(formId, { forml_source: sourceRef.current, title: newTitle });
    setActiveFormTitle(newTitle);
    if (activeProjectId) await reloadProjectDetail(activeProjectId);
    toast.success(`Renamed to "${newTitle}"`);
  }, [activeProjectId, reloadProjectDetail]);

  const handleRenameToDetected = useCallback(async () => {
    if (!activeFormId || !renameSuggestion) return;
    const newTitle = renameSuggestion;
    setRenameSuggestion(null);
    try {
      // Never show the "delete submissions?" dialog when there are none —
      // check first and only interrupt the author when it's actually relevant.
      const existing = await getResponses(activeFormId);
      if (existing.length === 0) {
        await applyRename(activeFormId, newTitle);
        return;
      }
      setRenameConfirm({ formId: activeFormId, title: newTitle, count: existing.length });
    } catch (err) {
      toast.error(`Couldn't rename — ${describeError(err)}`);
    }
  }, [activeFormId, renameSuggestion, applyRename]);

  const handleRenameOnly = useCallback(async () => {
    if (!renameConfirm) return;
    const { formId, title } = renameConfirm;
    setRenameConfirm(null);
    try {
      await applyRename(formId, title);
    } catch (err) {
      toast.error(`Couldn't rename — ${describeError(err)}`);
    }
  }, [renameConfirm, applyRename]);

  const handleRenameAndDelete = useCallback(async () => {
    if (!renameConfirm) return;
    const { formId, title } = renameConfirm;
    setRenamingBusy(true);
    try {
      await deleteAllResponses(formId);
      await applyRename(formId, title);
      setRenameConfirm(null);
      toast.success("Submissions deleted");
    } catch (err) {
      toast.error(`Couldn't delete submissions — ${describeError(err)}`);
    } finally {
      setRenamingBusy(false);
    }
  }, [renameConfirm, applyRename]);

  const handleKeepCurrentTitle = useCallback(() => {
    dismissedTitleRef.current = renameSuggestion;
    setRenameSuggestion(null);
  }, [renameSuggestion]);

  // ── Publish ──────────────────────────────────────────────────────────────────
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedEmbed, setPublishedEmbed] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);

  const handlePublish = useCallback(async () => {
    if (!activeFormId || !wasmReady) return;
    const result = compile(source);
    if (!result.ok || !result.ast) {
      setDiagOpen(true);
      appendLog({ level: "error", message: "Publish blocked — this form has compile errors" });
      return;
    }
    setPublishState("publishing");
    appendLog({ level: "info", message: "Publishing…" });
    try {
      await updateForm(activeFormId, { forml_source: source, compiled_schema: result.ast });
      const published = await publishForm(activeFormId, result.ast, window.location.origin);
      setPublishedUrl(published.public_url);
      setPublishedEmbed(published.embed_snippet);
      setPublishState("done");
      setShowPublishModal(true);
      appendLog({ level: "success", message: `Published → ${published.public_url}` });
      if (activeProjectId) await reloadProjectDetail(activeProjectId);
    } catch (err) {
      setPublishState("error");
      const message = describeError(err);
      appendLog({ level: "error", message: `Publish failed — ${message}` });
      toast.error(`Publish failed — ${message}`);
    }
  }, [activeFormId, wasmReady, compile, source, appendLog, activeProjectId, reloadProjectDetail]);

  useEffect(() => {
    if (!explorerPanelRef.current) return;
    if (explorerOpen) explorerPanelRef.current.expand(); else explorerPanelRef.current.collapse();
  }, [explorerOpen]);

  useEffect(() => {
    if (!diagPanelRef.current) return;
    if (diagOpen) diagPanelRef.current.expand(); else diagPanelRef.current.collapse();
  }, [diagOpen]);

  useEffect(() => {
    if (!aiPanelRef.current) return;
    if (aiOpen) aiPanelRef.current.expand(); else aiPanelRef.current.collapse();
  }, [aiOpen]);

  const ast = useMemo<ASTNode | null>(() => (compileResult?.ast as ASTNode | null) ?? null, [compileResult]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
          <span className="font-inter text-xs font-black tracking-tighter text-accent">FX</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background font-inter text-foreground">
      <TopBar
        projects={projects}
        activeProjectId={activeProjectId}
        activeFormTitle={activeFormTitle}
        onSelectProject={handleSelectProject}
        compilePhase={compilePhase}
        saveState={saveState}
        wasmReady={wasmReady}
        onManualCompile={() => manualCompileHandlerRef.current()}
        onPublish={handlePublish}
        publishState={publishState}
        onOpenSubmissions={() => setShowSubmissions(true)}
        canPublish={!!activeFormId && compilePhase === "valid"}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((p) => !p)}
      />

      <RenameSuggestion
        detectedTitle={renameSuggestion}
        onRename={handleRenameToDetected}
        onKeepCurrent={handleKeepCurrentTitle}
      />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center md:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
          <FileCode2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-inter text-sm font-medium text-foreground">The workspace needs a wider screen</p>
          <p className="mt-1 font-inter text-xs text-muted-foreground">Resize your window or switch to a tablet/desktop device.</p>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden md:flex">
        <aside className="flex w-12 flex-none flex-col items-center border-r border-border bg-card py-3">
          <div className="relative flex h-10 w-11 items-center justify-center text-foreground">
            <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-accent" />
            <Files className="h-4 w-4" />
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PanelGroup direction="vertical" className="min-h-0 flex-1">
            <Panel defaultSize={78} minSize={35}>
              <PanelGroup direction="horizontal" className="h-full">
                <Panel ref={explorerPanelRef} defaultSize={15} minSize={14} maxSize={30} collapsible>
                  <ProjectExplorer
                    projects={projects}
                    projectDetails={projectDetails}
                    activeProjectId={activeProjectId}
                    activeFormId={activeFormId}
                    loadingProjects={loadingProjects}
                    onSelectProject={handleSelectProject}
                    onSelectForm={handleSelectForm}
                    onCreateProject={handleCreateProject}
                    onCreateForm={handleCreateForm}
                    onDeleteProject={handleDeleteProject}
                    onDeleteForm={handleDeleteForm}
                  />
                </Panel>

                <PanelResizeHandle className="group relative flex w-1.5 shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
                  <span className="h-full w-px bg-border transition-all duration-150 group-hover:w-0.5 group-hover:bg-accent/60" />
                </PanelResizeHandle>

                <Panel defaultSize={39} minSize={26}>
                  <EditorPane
                    formId={activeFormId}
                    source={source}
                    compilePhase={compilePhase}
                    diagnostics={compileResult?.diagnostics ?? []}
                    onContentChange={handleContentChange}
                    onCursorChange={setCursor}
                    onToggleDiag={() => setDiagOpen((p) => !p)}
                    onManualCompileRef={manualCompileHandlerRef}
                    onSelectionChange={setSelection}
                    controlRef={editorControlRef}
                  />
                </Panel>

                <PanelResizeHandle className="group relative flex w-1.5 shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
                  <span className="h-full w-px bg-border transition-all duration-150 group-hover:w-0.5 group-hover:bg-accent/60" />
                </PanelResizeHandle>

                <Panel defaultSize={22} minSize={18}>
                  <PreviewPane ast={ast} source={source} compilePhase={compilePhase} />
                </Panel>

                <PanelResizeHandle className="group relative flex w-1.5 shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
                  <span className="h-full w-px bg-border transition-all duration-150 group-hover:w-0.5 group-hover:bg-accent/60" />
                </PanelResizeHandle>

                <Panel
                  ref={aiPanelRef}
                  defaultSize={24}
                  minSize={22}
                  maxSize={40}
                  collapsible
                  onCollapse={() => setAiOpen(false)}
                  onExpand={() => setAiOpen(true)}
                >
                  <AiPanel
                    formId={activeFormId}
                    source={source}
                    diagnostics={compileResult?.diagnostics ?? []}
                    selection={selection}
                    onApplyToEditor={handleApplyToEditor}
                    onClose={() => setAiOpen(false)}
                  />
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="group relative flex h-1.5 shrink-0 cursor-row-resize items-center justify-center bg-transparent">
              <span className="h-px w-full bg-border transition-all duration-150 group-hover:h-0.5 group-hover:bg-accent/60" />
            </PanelResizeHandle>

            <Panel
              ref={diagPanelRef}
              defaultSize={22}
              minSize={12}
              maxSize={55}
              collapsible
              onCollapse={() => setDiagOpen(false)}
              onExpand={() => setDiagOpen(true)}
            >
              <DiagnosticsPanel
                onToggle={() => setDiagOpen((p) => !p)}
                compileResult={compileResult}
                activeFormTitle={activeFormTitle ?? "—"}
                log={compileLog}
              />
            </Panel>
          </PanelGroup>
        </div>
      </div>

      <div className="flex h-7 flex-none items-center justify-between border-t border-border bg-card px-4 font-mono text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setDiagOpen((p) => !p)} className="transition-colors hover:text-foreground">
            Problems
          </button>
          <span className="h-3 w-px bg-border" />
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${wasmReady ? "bg-success" : "bg-warning animate-pulse"}`} />
            {wasmReady ? "WASM active · C++ compiler" : "WASM loading…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ln {cursor.line}, Col {cursor.column}</span>
          <span className="h-3 w-px bg-border" />
          <span>UTF-8</span>
          {compileMs !== null && (
            <>
              <span className="h-3 w-px bg-border" />
              <span>{compileMs} ms</span>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showPublishModal && publishedUrl && publishedEmbed && (
          <PublishDialog
            url={publishedUrl}
            embed={publishedEmbed}
            onClose={() => { setShowPublishModal(false); setPublishState("idle"); }}
          />
        )}
      </AnimatePresence>

      <SubmissionsPanel
        projectId={activeProjectId}
        formId={activeFormId}
        formTitle={activeFormTitle}
        open={showSubmissions}
        onOpenChange={setShowSubmissions}
      />

      <AlertDialog open={!!renameConfirm} onOpenChange={(o) => { if (!o) setRenameConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename project and delete existing submissions?</AlertDialogTitle>
            <AlertDialogDescription>
              {renameConfirm && (
                <>
                  This form already has {renameConfirm.count} submission{renameConfirm.count === 1 ? "" : "s"}.
                  Renaming to &ldquo;{renameConfirm.title}&rdquo; won&apos;t affect them unless you choose to delete.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renamingBusy}>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={handleRenameOnly}
              disabled={renamingBusy}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 py-2 font-inter text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              Rename Only
            </button>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRenameAndDelete(); }}
              disabled={renamingBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {renamingBusy ? "Deleting…" : "Rename & Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
