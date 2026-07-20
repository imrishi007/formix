"use client";

// components/editor/compiler-playground.tsx
//
// The FormL compiler playground — a three-panel view into what the WASM
// compiler does with your source. Distinct from DemoIdeShell (the authoring
// IDE with project / publish flow); this page is for understanding the
// compiler pipeline itself: source → AST → schema → rendered form, plus
// real diagnostics.
//
// Mounted at /compiler (see app/compiler/page.tsx).

import dynamic from "next/dynamic";
import type { editor as MonacoEditorNS } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileCode2,
  Loader2,
  Play,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  useFormlCompiler,
  type FormlCompileResult,
  type FormlDiagnostic,
} from "@/lib/use-forml-compiler";
import {
  defineFormixMono,
  MONACO_OPTIONS,
  type MonacoLike,
} from "@/lib/monaco-forml";
import { registerFormlLanguageService } from "@/lib/monaco-forml-language";
import {
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";

// ── Types ────────────────────────────────────────────────────────────────────

type CompilePhase = "idle" | "valid" | "error";
type DiagTab = "ast" | "schema" | "problems" | "source";
interface CursorState { line: number; column: number; }

// ── Default playground source ────────────────────────────────────────────────
// Covers most of the language in one small file: pages, sections, field types,
// validation, conditionals, repeat groups, a computed field, and an action.

const PLAYGROUND_DEFAULT = `-- Welcome to the FormL compiler playground.
-- Edit the source on the left; the panels on the right update live.
form "Job Application" {

  page "Personal" {

    section "Identity" {
      row {
        field fullName : text
          ui { label: "Full Name"  placeholder: "Jane Doe" }
          validate { required  minLength: 2  maxLength: 100 }

        field age : integer
          ui { label: "Age" }
          validate { min: 18  max: 80 }
      }
    }

    field email : email
      ui { label: "Email"  placeholder: "jane@example.com" }
      validate { required }

    field role : select {
      option "Engineer"
      option "Designer"
      option "PM"
    }
    ui { label: "Role" }

    if age >= 18 {
      field experience : text
        ui { label: "Years of experience" }
    } else {
      field guardian : text
        ui { label: "Guardian name" }
    }

    repeat count = jobs {
      field company : text  ui { label: "Company" }
      field years   : integer  validate { min: 0  max: 60 }
    }

    field jobs : integer  ui { label: "Past jobs to list" }

    field score : float compute = age * 1.5 + 10
  }

  action submit {
    endpoint: "https://api.formix.dev/apply"
    method: POST
  }
}`;

// ── Monaco (dynamic import) ──────────────────────────────────────────────────

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D]">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">
        Loading editor...
      </span>
    </div>
  ),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Collect every Field node from the AST (across pages, sections, conditionals). */
function collectFields(ast: ASTNode | null): ASTNode[] {
  if (!ast) return [];
  const out: ASTNode[] = [];

  const walk = (stmts: ASTNode[] | undefined) => {
    if (!Array.isArray(stmts)) return;
    for (const s of stmts) {
      const t = s.type as string;
      if (t === "Field") out.push(s);
      else if (t === "Page" || t === "Section" || t === "Layout") {
        walk(s.statements as ASTNode[] | undefined);
      } else if (t === "Conditional") {
        walk(s.then as ASTNode[] | undefined);
        walk(s.else as ASTNode[] | undefined);
      } else if (t === "RepeatGroup") {
        // repeated field definitions are templates, not rendered instances
        walk(s.fields as ASTNode[] | undefined);
      }
    }
  };

  walk(ast.statements as ASTNode[] | undefined);
  walk(ast.pages as ASTNode[] | undefined);
  return out;
}

/** Build the simplified JSON-schema projection shown in the "Schema" tab. */
function buildSchema(ast: ASTNode | null) {
  if (!ast) return null;
  const fields = collectFields(ast).map((f) => {
    const ui = f.ui as ASTNode | undefined;
    const validation = f.validation as ASTNode | undefined;
    return {
      name: f.name,
      type: f.fieldType,
      label: (ui?.label as string) ?? f.name,
      placeholder: ui?.placeholder,
      helpText: ui?.helpText,
      options: (f.options as string[])?.length ? f.options : undefined,
      validation: validation ?? undefined,
    };
  });
  return {
    $schema: "https://formix.dev/schema/v1",
    title: ast.name,
    fields,
  };
}

// ── Small UI atoms shared by the playground ─────────────────────────────────

function PhaseBadge({ phase, wasmReady, compileMs }: {
  phase: CompilePhase; wasmReady: boolean; compileMs: number | null;
}) {
  const cfg = !wasmReady
    ? { text: "Loading WASM…", dot: "bg-[#C4A35A] animate-pulse", color: "text-[#C4A35A]" }
    : phase === "valid"
      ? { text: "Compiled", dot: "bg-[#7C6FE0]", color: "text-[#7C6FE0]" }
      : phase === "error"
        ? { text: "Compile Error", dot: "bg-[#E05252]", color: "text-[#E05252]" }
        : { text: "Ready", dot: "bg-[#4ADE80]", color: "text-[#4ADE80]" };

  return (
    <div className={`flex items-center gap-1.5 ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className="font-inter text-[10px] font-medium">{cfg.text}</span>
      {wasmReady && phase === "valid" && compileMs !== null && (
        <span className="ml-1 font-mono text-[9px] text-[#666666]">{compileMs}ms</span>
      )}
    </div>
  );
}

function DiagIcon({ severity }: { severity: FormlDiagnostic["severity"] }) {
  if (severity === "error") return <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-[#E05252]" />;
  if (severity === "warning") return <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-[#C4A35A]" />;
  return <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-none text-[#888888]" />;
}

// ── Right panel: tabbed compiler output ──────────────────────────────────────

const DIAG_TABS: Array<{ id: DiagTab; label: string }> = [
  { id: "ast",      label: "AST" },
  { id: "schema",   label: "Schema" },
  { id: "problems", label: "Problems" },
  { id: "source",   label: "Raw JSON" },
];

function DiagnosticsContent({
  tab, compileResult,
}: {
  tab: DiagTab; compileResult: FormlCompileResult | null;
}) {
  if (tab === "problems") {
    const diags = compileResult?.diagnostics ?? [];
    const errors   = diags.filter((d) => d.severity === "error");
    const warnings = diags.filter((d) => d.severity === "warning");
    if (diags.length === 0) {
      return (
        <div className="flex items-center gap-2 p-4 text-[#4ADE80]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-inter text-[11px]">No problems detected</span>
        </div>
      );
    }
    return (
      <div className="space-y-1 p-3">
        {[...errors, ...warnings].map((d, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-[#141414]"
          >
            <DiagIcon severity={d.severity} />
            <div className="min-w-0">
              <p className={`font-inter text-[11px] ${
                d.severity === "error" ? "text-[#E05252]" : "text-[#C4A35A]"
              }`}>
                {d.message}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#666666]">
                Line {d.line}, Col {d.col} · {d.severity}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "ast") {
    const ast = compileResult?.ast ?? null;
    return (
      <pre className="p-4 font-mono text-[10px] leading-relaxed text-[#9A9AAA] overflow-auto">
        {ast
          ? JSON.stringify(ast, null, 2)
          : "// No AST — fix compile errors first."}
      </pre>
    );
  }

  if (tab === "schema") {
    const ast = compileResult?.ast as ASTNode | null;
    if (!ast) {
      return (
        <pre className="p-4 font-mono text-[10px] text-[#555555]">
          // No schema — fix compile errors first.
        </pre>
      );
    }
    const schema = buildSchema(ast);
    return (
      <pre className="p-4 font-mono text-[10px] leading-relaxed text-[#9A9AAA] overflow-auto">
        {JSON.stringify(schema, null, 2)}
      </pre>
    );
  }

  // tab === "source" — the raw { ast, diagnostics } envelope the compiler emits.
  return (
    <pre className="p-4 font-mono text-[10px] leading-relaxed text-[#9A9AAA] overflow-auto">
      {compileResult
        ? JSON.stringify(
            { ast: compileResult.ast, diagnostics: compileResult.diagnostics },
            null,
            2,
          )
        : "// Compile to see the raw compiler output."}
    </pre>
  );
}

function DiagnosticsPanel({
  compileResult, errorCount, warnCount,
}: {
  compileResult: FormlCompileResult | null;
  errorCount: number; warnCount: number;
}) {
  const [activeTab, setActiveTab] = useState<DiagTab>("ast");

  // Jump to Problems automatically when a compile fails.
  useEffect(() => {
    if (errorCount > 0) setActiveTab("problems");
  }, [errorCount]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0D0D0D]">
      <div className="flex h-9 flex-none items-center border-b border-[#252525]">
        {DIAG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`relative flex h-full items-center gap-1.5 px-4 font-inter text-[10px] transition-colors duration-150 ${
              activeTab === t.id
                ? "text-[#EDEDEB]"
                : "text-[#555555] hover:text-[#999999]"
            }`}
          >
            {activeTab === t.id && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#7C6FE0]" />
            )}
            {t.label}
            {t.id === "problems" && errorCount > 0 && (
              <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded bg-[#2A1010] px-1 font-mono text-[8px] font-bold text-[#E05252]">
                {errorCount}
              </span>
            )}
            {t.id === "problems" && warnCount > 0 && errorCount === 0 && (
              <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded bg-[#2A2210] px-1 font-mono text-[8px] font-bold text-[#C4A35A]">
                {warnCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <DiagnosticsContent tab={activeTab} compileResult={compileResult} />
      </div>
    </div>
  );
}

// ── Form preview (bottom-right) ──────────────────────────────────────────────

function PreviewPanel({
  ast, compilePhase, wasmReady,
}: {
  ast: ASTNode | null;
  compilePhase: CompilePhase;
  wasmReady: boolean;
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const allStatements = useMemo<ASTNode[]>(() => {
    if (!ast) return [];
    const pages = (ast.pages as ASTNode[]) ?? [];
    const stmts = (ast.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [ast]);

  const formTitle = (ast?.name as string) ?? "Untitled Form";

  if (!wasmReady) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F3EE] text-[#9A9080]">
        <span className="font-inter text-[11px]">Initializing compiler…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F3EE]">
      <div className="flex h-9 flex-none items-center justify-between border-b border-[#DDD5C0] bg-[#EDEAE2] px-4">
        <span className="font-inter text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7060]">
          Rendered Form
        </span>
        {compilePhase === "error" ? (
          <span className="flex items-center gap-1.5 font-inter text-[10px] text-[#E05252]">
            <AlertCircle className="h-3 w-3" /> Fix errors to preview
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-inter text-[10px] text-[#7C6FE0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C6FE0]" /> Live
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {compilePhase === "error" ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F0CECE] bg-[#FDF0F0]">
                <AlertCircle className="h-5 w-5 text-[#E05252]" />
              </div>
              <p className="font-inter text-[13px] font-semibold text-[#1A1410]">
                Compile Error
              </p>
              <p className="font-inter text-[11px] leading-relaxed text-[#7A7060]">
                See the Problems tab for details. The preview returns once the
                source compiles cleanly.
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mx-auto w-full max-w-[380px]"
          >
            <div className="overflow-hidden rounded-lg border border-[#D4CCB8] bg-[#FAF8F2] shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
              <div className="border-b border-[#E4DCD0] bg-[#F0EDE5] px-6 py-5">
                <span className="inline-flex items-center gap-1 rounded border border-[#7C6FE0]/30 bg-[#7C6FE0]/10 px-2 py-0.5 font-inter text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7C6FE0]">
                  Preview
                </span>
                <h2 className="mt-2.5 font-inter text-[20px] font-bold tracking-tight text-[#1A1410]">
                  {formTitle}
                </h2>
              </div>
              <div className="space-y-5 px-6 py-6">
                {allStatements.length > 0 ? (
                  <RenderStatements
                    stmts={allStatements}
                    values={formValues}
                    onChange={handleChange}
                  />
                ) : (
                  <p className="font-inter text-[11px] text-[#B4AA96]">
                    No renderable statements yet.
                  </p>
                )}
              </div>
              <div className="border-t border-[#E4DCD0] px-6 py-4">
                <button
                  type="button"
                  className="w-full rounded-md bg-[#7C6FE0] py-2.5 font-inter text-[12px] font-semibold text-white transition-all duration-150 hover:bg-[#6B5FD0] active:scale-[0.98]"
                >
                  Submit Form
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  phase, wasmReady, compileMs, onManualCompile,
}: {
  phase: CompilePhase;
  wasmReady: boolean;
  compileMs: number | null;
  onManualCompile: () => void;
}) {
  return (
    <div className="flex h-10 flex-none items-center justify-between border-b border-[#252525] bg-[#0D0D0D] px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded border border-[#2D2D3D] bg-[#141420]">
            <span className="font-inter text-[9px] font-black tracking-tighter text-[#7C6FE0]">FX</span>
          </div>
          <span className="font-inter text-[12px] font-semibold tracking-tight text-[#EDEDEB]">Formix</span>
        </div>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <div className="flex items-center gap-1 font-inter text-[11px]">
          <span className="text-[#555555]">playground</span>
          <ChevronRight className="h-3 w-3 text-[#3A3A3A]" />
          <span className="text-[#999999]">compiler.fls</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PhaseBadge phase={phase} wasmReady={wasmReady} compileMs={compileMs} />
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <button
          type="button"
          onClick={onManualCompile}
          disabled={!wasmReady}
          className="flex items-center gap-1.5 rounded-md bg-[#7C6FE0] px-3 py-1.5 font-inter text-[10px] font-semibold text-white transition-all duration-150 hover:bg-[#8A7DF0] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Play className="h-3 w-3" />
          Compile
        </button>
      </div>
    </div>
  );
}

function StatusBar({
  wasmReady, phase, cursor, compileMs,
}: {
  wasmReady: boolean;
  phase: CompilePhase;
  cursor: CursorState;
  compileMs: number | null;
}) {
  return (
    <div className="flex h-6 flex-none items-center justify-between border-t border-[#252525] bg-[#0D0D0D] px-3">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#555555]">
          <Zap className="h-2.5 w-2.5" />
          WASM compiler
        </span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        {!wasmReady ? (
          <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#888888]">
            <Loader2 className="h-2 w-2 animate-spin" /> Loading…
          </span>
        ) : (
          <span className="font-inter text-[9px] text-[#7C6FE0]">
            ✓ Ready{compileMs !== null ? ` · ${compileMs}ms last compile` : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-inter text-[9px] text-[#666666]">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="font-inter text-[9px] text-[#555555]">
          {phase === "error" ? "1 error" : "No errors"}
        </span>
      </div>
    </div>
  );
}

function PartitionHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-[3px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
      <span className="h-full w-px bg-[#252525] transition-all duration-150 group-hover:w-[2px] group-hover:bg-[#7C6FE0]/40" />
    </PanelResizeHandle>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function CompilerPlayground() {
  const { ready: wasmReady, loadError, compile } = useFormlCompiler();

  const [source, setSource] = useState<string>(PLAYGROUND_DEFAULT);
  const [compileResult, setCompileResult] = useState<FormlCompileResult | null>(null);
  const [compilePhase, setCompilePhase] = useState<CompilePhase>("idle");
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const [cursor, setCursor] = useState<CursorState>({ line: 1, column: 1 });

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoLike | null>(null);
  const editTimerRef = useRef<number | null>(null);

  // Real compile — no fake setTimeout phases. The WASM call is synchronous,
  // so we set valid/error immediately based on its result.
  const runCompile = useCallback((src: string) => {
    if (!wasmReady) return;
    const result = compile(src);
    setCompileResult(result);
    setCompilePhase(result.ok ? "valid" : "error");
    setCompileMs(result.durationMs);
  }, [wasmReady, compile]);

  // Compile on mount once WASM is ready, and on a 400ms debounce after edits.
  useEffect(() => {
    if (!wasmReady) return;
    runCompile(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasmReady]);

  const handleContentChange = useCallback((value: string | undefined) => {
    const next = value ?? "";
    setSource(next);
    if (!wasmReady) return;
    if (editTimerRef.current) window.clearTimeout(editTimerRef.current);
    editTimerRef.current = window.setTimeout(() => runCompile(next), 400);
  }, [wasmReady, runCompile]);

  useEffect(() => () => {
    if (editTimerRef.current) window.clearTimeout(editTimerRef.current);
  }, []);

  const errorCount = compileResult?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const warnCount  = compileResult?.diagnostics.filter((d) => d.severity === "warning").length ?? 0;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#0D0D0D] font-inter text-[#EDEDEB]">
      <TopBar
        phase={compilePhase}
        wasmReady={wasmReady}
        compileMs={compileMs}
        onManualCompile={() => runCompile(source)}
      />

      {loadError && (
        <div className="flex flex-none items-center gap-2 border-b border-[#3D1A1A] bg-[#1E0E0E] px-4 py-2 text-[#E05252]">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-inter text-[11px]">
            Failed to load the WASM compiler from /wasm/forml.js. Check your network connection and reload.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="min-h-0 flex-1">
          {/* Editor */}
          <Panel defaultSize={48} minSize={28}>
            <div className="relative flex h-full min-h-0 flex-col bg-[#0D0D0D]">
              <div className="flex h-9 flex-none items-center gap-2 border-b border-[#252525] px-4">
                <FileCode2 className="h-3.5 w-3.5 text-[#9090A8]" />
                <span className="font-inter text-[11px] text-[#999999]">compiler.fls</span>
                <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-[#444444]">FormL</span>
              </div>
              <div className="relative min-h-0 flex-1">
                <MonacoEditor
                  beforeMount={(monaco) => {
                    defineFormixMono(monaco as unknown as MonacoLike);
                    registerFormlLanguageService(monaco as unknown as MonacoLike);
                  }}
                  theme="formix-mono"
                  language="forml"
                  value={source}
                  onChange={handleContentChange}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor as MonacoEditorNS.IStandaloneCodeEditor;
                    monacoRef.current = monaco as unknown as MonacoLike;
                    monaco.editor.setTheme("formix-mono");
                    editor.updateOptions(MONACO_OPTIONS);
                    editor.onDidChangeCursorPosition((event) => {
                      setCursor({ line: event.position.lineNumber, column: event.position.column });
                    });
                  }}
                  options={MONACO_OPTIONS}
                />
              </div>
            </div>
          </Panel>

          <PartitionHandle />

          {/* Right: diagnostics + preview, stacked vertically */}
          <Panel defaultSize={52} minSize={28}>
            <PanelGroup direction="vertical" className="min-h-0">
              <Panel defaultSize={55} minSize={20}>
                <DiagnosticsPanel
                  compileResult={compileResult}
                  errorCount={errorCount}
                  warnCount={warnCount}
                />
              </Panel>
              <PanelResizeHandle className="group relative flex h-[3px] shrink-0 cursor-row-resize items-center justify-center bg-transparent">
                <span className="h-px w-full bg-[#252525] transition-all duration-150 group-hover:h-[2px] group-hover:bg-[#7C6FE0]/40" />
              </PanelResizeHandle>
              <Panel defaultSize={45} minSize={20}>
                <PreviewPanel
                  ast={compileResult?.ast ?? null}
                  compilePhase={compilePhase}
                  wasmReady={wasmReady}
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar
        wasmReady={wasmReady}
        phase={compilePhase}
        cursor={cursor}
        compileMs={compileMs}
      />
    </div>
  );
}
