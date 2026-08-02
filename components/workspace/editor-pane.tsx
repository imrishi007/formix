"use client";

/**
 * components/workspace/editor-pane.tsx
 * Monaco editor pane for the active form. Keeps one ITextModel per form id
 * (model-per-file pattern, analogous to the old demo-ide-shell.tsx) so
 * switching between forms doesn't lose undo history or cause a remount
 * flicker. lib/monaco-forml.ts / lib/monaco-forml-language.ts are reused
 * unchanged — this component only owns the surrounding chrome.
 */

import dynamic from "next/dynamic";
import type { editor as MonacoEditorNS } from "monaco-editor";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTheme } from "next-themes";
import { AlertCircle, CheckCircle2, FileCode2, Loader2, Map as MapIcon, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  defineFormixMono,
  MONACO_OPTIONS,
  FORML_THEME_DARK,
  FORML_THEME_LIGHT,
  type MonacoLike,
} from "@/lib/monaco-forml";
import { registerFormlLanguageService } from "@/lib/monaco-forml-language";
import type { FormlDiagnostic } from "@/lib/use-forml-compiler";
import type { CompilePhase } from "@/components/workspace/top-bar";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--bg-base)">
      <Loader2 className="h-5 w-5 animate-spin text-(--accent-primary)" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-tertiary)">Loading editor…</span>
    </div>
  ),
});

function CompilerBadge({ phase }: { phase: CompilePhase }) {
  const configs: Record<CompilePhase, { text: string; color: string; icon: React.ReactNode } | null> = {
    idle: null,
    parsing:  { text: "Parsing...",           color: "bg-(--bg-subtle) text-(--ink-secondary) border-(--border-hairline)", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    semantic: { text: "Semantic Analysis...", color: "bg-(--bg-subtle) text-(--ink-secondary) border-(--border-hairline)", icon: <Zap className="h-3 w-3" /> },
    valid:    { text: "Compiled ✓",           color: "bg-(--accent-primary-tint) text-(--accent-primary) border-(--accent-primary)/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    error:    { text: "Compile Error",        color: "bg-(--accent-danger)/10 text-(--accent-danger) border-(--accent-danger)/20", icon: <AlertCircle className="h-3 w-3" /> },
  };
  const config = phase !== "idle" ? configs[phase] : null;
  return (
    <AnimatePresence mode="wait">
      {config && (
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className={`pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-medium ${config.color}`}
        >
          {config.icon}
          {config.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MinimapToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={enabled ? "Hide minimap" : "Show minimap"}
      aria-pressed={enabled}
      title={enabled ? "Hide minimap" : "Show minimap"}
      className={`pointer-events-auto absolute bottom-3 right-4 z-10 flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
        enabled ? "border-(--accent-primary)/20 bg-(--accent-primary-tint) text-(--accent-primary)" : "border-(--border-hairline) bg-(--bg-subtle) text-(--ink-tertiary) hover:text-(--ink-secondary)"
      }`}
    >
      <MapIcon className="h-3 w-3" />
      Minimap
    </button>
  );
}

export interface EditorControl {
  setValue: (value: string) => void;
}

export function EditorPane({
  formId,
  source,
  compilePhase,
  diagnostics,
  onContentChange,
  onCursorChange,
  onToggleDiag,
  onManualCompileRef,
  onSelectionChange,
  controlRef,
}: {
  formId: string | null;
  source: string;
  compilePhase: CompilePhase;
  diagnostics: FormlDiagnostic[];
  onContentChange: (value: string) => void;
  onCursorChange: (cursor: { line: number; column: number }) => void;
  onToggleDiag: () => void;
  /** The editor wires Ctrl+S/Ctrl+Enter to whatever this ref currently points
   *  to, so the parent can update its "run compile" handler without us
   *  needing to re-register Monaco commands on every render. */
  onManualCompileRef: MutableRefObject<() => void>;
  /** Fires with the currently-selected text (empty string if none) — lets
   *  the AI panel offer "Explain Selection" instead of "Explain Form". */
  onSelectionChange?: (text: string) => void;
  /** Populated on mount so the parent (e.g. the AI panel applying a
   *  generated/fixed form) can push new content through the same
   *  onChange → compile/save pipeline a real keystroke would. */
  controlRef?: MutableRefObject<EditorControl>;
}) {
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoLike | null>(null);
  const modelsRef = useRef<Map<string, MonacoEditorNS.ITextModel>>(new Map());
  const [minimapEnabled, setMinimapEnabled] = useState(true);

  // The Monaco canvas follows the app theme (design.md §Code Editor):
  // Latte palette in light mode, design.md's navy syntax colors (blue
  // keywords, green types, amber strings) in dark. Handing the theme name to
  // the `theme` prop makes @monaco-editor/react swap it reactively on toggle.
  const { resolvedTheme } = useTheme();
  const editorTheme = resolvedTheme === "dark" ? FORML_THEME_DARK : FORML_THEME_LIGHT;

  const toggleMinimap = useCallback(() => {
    setMinimapEnabled((prev) => {
      const next = !prev;
      editorRef.current?.updateOptions({ minimap: { enabled: next } });
      return next;
    });
  }, []);

  // Keep markers in sync with diagnostics.
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const monaco = monacoRef.current;
    const markers = diagnostics.map((d) => ({
      startLineNumber: Math.max(d.line, 1), endLineNumber: Math.max(d.line, 1),
      startColumn: Math.max(d.col, 1), endColumn: Math.max(d.col + 1, 2),
      message: d.message,
      severity: d.severity === "error" ? monaco.MarkerSeverity.Error
        : d.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
      source: "FormL",
    }));
    monaco.editor.setModelMarkers(model, "forml-compiler", markers);
  }, [diagnostics]);

  // Swap to the model for the active form (create it on first visit).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current as unknown as { editor: { createModel: (v: string, lang: string) => MonacoEditorNS.ITextModel } } | null;
    if (!editor || !monaco || !formId) return;

    let model = modelsRef.current.get(formId);
    if (!model) {
      model = monaco.editor.createModel(source, "forml");
      modelsRef.current.set(formId, model);
    }
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }
  // Deliberately excludes `source` — this effect only runs on formId change;
  // subsequent source updates from outside (none currently) shouldn't reset
  // the model's own content and fight the user's typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  // Dispose models for forms no longer open in this session (basic cap so a
  // long editing session doesn't leak Monaco models indefinitely).
  useEffect(() => {
    if (modelsRef.current.size <= 20) return;
    const entries = [...modelsRef.current.entries()];
    for (const [id, model] of entries.slice(0, entries.length - 20)) {
      if (id !== formId) { model.dispose(); modelsRef.current.delete(id); }
    }
  }, [formId]);

  if (!formId) {
    return (
      <div
        className="flex h-full min-h-0 flex-col items-center justify-center bg-(--bg-base)"
        style={{ backgroundImage: "radial-gradient(circle, rgba(23,23,23,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-(--border-hairline) bg-(--bg-surface)">
          <FileCode2 className="h-5 w-5 text-(--ink-disabled)" />
        </div>
        <p className="mt-4 text-sm text-(--ink-tertiary)">Select a form to start editing</p>
        <p className="mt-1 text-xs text-(--ink-disabled)">Choose or create a form in the Project Explorer</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-(--bg-base)">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Absolute-positioned host, not a flex/percentage-height child — this
         *  is the bulletproof fix for Monaco's classic "grows its container"
         *  bug: an element with inset-0 fills its nearest positioned ancestor
         *  exactly, regardless of any percentage-height resolution quirks up
         *  the flex chain, so Monaco's own internal scrolling takes over
         *  instead of the page. */}
        <div className="absolute inset-0">
        <MonacoEditor
          height="100%"
          width="100%"
          beforeMount={(monaco) => {
            defineFormixMono(monaco as unknown as MonacoLike);
            registerFormlLanguageService(monaco as unknown as MonacoLike);
          }}
          theme={editorTheme}
          language="forml"
          value={source}
          onChange={(value) => onContentChange(value ?? "")}
          onMount={(editor, monaco) => {
            editorRef.current = editor as MonacoEditorNS.IStandaloneCodeEditor;
            monacoRef.current = monaco as unknown as MonacoLike;
            editor.updateOptions(MONACO_OPTIONS);

            if (formId) {
              const existing = modelsRef.current.get(formId);
              const model = existing ?? monaco.editor.createModel(source, "forml");
              if (!existing) modelsRef.current.set(formId, model);
              editor.setModel(model);
            }

            editor.onDidChangeCursorPosition((event) => {
              onCursorChange({ line: event.position.lineNumber, column: event.position.column });
            });

            editor.onDidChangeCursorSelection((event) => {
              const model = editor.getModel();
              onSelectionChange?.(model ? model.getValueInRange(event.selection) : "");
            });

            if (controlRef) {
              controlRef.current = {
                setValue: (value: string) => editor.setValue(value),
              };
            }

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onManualCompileRef.current());
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onManualCompileRef.current());
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => onToggleDiag());

            editor.addAction({
              id: "formix.compile",
              label: "FormL: Compile Current File",
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
              run: () => onManualCompileRef.current(),
            });
            editor.addAction({
              id: "formix.toggleDiagnostics",
              label: "FormL: Toggle Diagnostics Panel",
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ],
              run: () => onToggleDiag(),
            });
          }}
          options={MONACO_OPTIONS}
        />
        </div>
        <CompilerBadge phase={compilePhase} />
        <MinimapToggle enabled={minimapEnabled} onToggle={toggleMinimap} />
      </div>
    </div>
  );
}
