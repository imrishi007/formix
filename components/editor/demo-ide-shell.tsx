"use client";

import dynamic from "next/dynamic";
import type { editor as MonacoEditorNS } from "monaco-editor";
import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  Files,
  Folder,
  FolderOpen,
  GitBranch,
  Globe,
  Loader2,
  Plus,
  Terminal,
  Trash2,
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
  getFileSystemStore,
  newFormlTemplate,
  type VirtualFile,
} from "@/lib/forml-file-system";
import {
  evalCondition,
  INPUT_CLS,
  DynamicField,
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";
import { createForm, updateForm, publishForm } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarTool = "files";
type CompilePhase = "idle" | "parsing" | "semantic" | "valid" | "error";
type DiagTab = "problems" | "ast" | "json" | "tokens";
type PublishState = "idle" | "publishing" | "done" | "error";
// ASTNode is imported from @/components/form-renderer

interface CursorState { line: number; column: number; }

interface MonacoThemeRule { token: string; foreground: string; fontStyle?: string; }
interface MonacoTheme { base: "vs-dark"; inherit: boolean; rules: MonacoThemeRule[]; colors: Record<string, string>; }
interface MonacoLanguageRegistry {
  getLanguages: () => Array<{ id: string }>;
  register: (language: { id: string }) => void;
  setMonarchTokensProvider: (id: string, p: Record<string, unknown>) => void;
}
interface MonacoEditorAPI {
  defineTheme: (name: string, theme: MonacoTheme) => void;
  setTheme: (name: string) => void;
  setModelMarkers: (model: MonacoEditorNS.ITextModel, owner: string, markers: MonacoEditorNS.IMarkerData[]) => void;
}
interface MonacoLike {
  editor: MonacoEditorAPI;
  languages: MonacoLanguageRegistry;
  MarkerSeverity: { Error: number; Warning: number; Info: number };
}

// ─── Monaco (dynamic import) ──────────────────────────────────────────────────

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

// ─── Monaco Options ───────────────────────────────────────────────────────────

const MONACO_OPTIONS = {
  automaticLayout: true,
  contextmenu: false,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: false,
  fontSize: 13,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 8,
  lineHeight: 22,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 3,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  quickSuggestions: false,
  renderLineHighlight: "line" as const,
  renderValidationDecorations: "off" as const,
  renderWhitespace: "none" as const,
  scrollbar: { alwaysConsumeMouseWheel: false, horizontalScrollbarSize: 4, verticalScrollbarSize: 4 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  suggest: { showWords: false },
  parameterHints: { enabled: false },
  hover: { enabled: false },
  folding: false,
  glyphMargin: false,
  bracketPairColorization: { enabled: false },
  colorDecorators: false,
  occurrencesHighlight: "off" as const,
  selectionHighlight: false,
  wordWrap: "off" as const,
  codeLens: false,
  links: false,
  padding: { top: 16, bottom: 64 },
};

// ─── Formix Monaco Theme ──────────────────────────────────────────────────────

function defineFormixMono(monaco: MonacoLike) {
  const languageId = "forml";
  if (!monaco.languages.getLanguages().some((l) => l.id === languageId)) {
    monaco.languages.register({ id: languageId });
  }
  monaco.languages.setMonarchTokensProvider(languageId, {
    tokenizer: {
      root: [
        [/\b(?:form|field|ui|validate|action|submit|option|required|minLength|maxLength|pattern|min|max|POST|PUT|PATCH|text|email|select|radio|checkbox|integer|float|date|boolean|url|label|placeholder|helpText|endpoint|method|default|bind|page|section|group|use|var|repeat|count|if|else|on|compute|from|map|row|column|load|change|blur|hide|show|clear|set|navigate)\b/, "keyword"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/\d+(?:\.\d+)?/, "number"],
        [/[{}()[\]:;,=]/, "delimiter"],
        [/==|!=|<=|>=|&&|\|\||[<>+\-*/]/, "operator"],
        [/[a-zA-Z_]\w*/, "identifier"],
        [/--.*$/, "comment"],
      ],
      string: [[/[^\\"]+/, "string"], [/\\./, "string"], [/"/, "string", "@pop"]],
    },
  });
  monaco.editor.defineTheme("formix-mono", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "EDEDEB" },
      { token: "keyword", foreground: "C9B8FF", fontStyle: "bold" },
      { token: "string", foreground: "C8BA9A" },
      { token: "string.invalid", foreground: "E05252" },
      { token: "number", foreground: "9090A0" },
      { token: "delimiter", foreground: "505060" },
      { token: "operator", foreground: "A0A0B0" },
      { token: "identifier", foreground: "C8C8CC" },
      { token: "comment", foreground: "4A4A5A", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#0D0D0D",
      "editor.foreground": "#EDEDEB",
      "editorLineNumber.foreground": "#3A3A3A",
      "editorLineNumber.activeForeground": "#8A8A8A",
      "editorGutter.background": "#0D0D0D",
      "editorCursor.foreground": "#EDEDEB",
      "editor.selectionBackground": "#7C6FE028",
      "editor.inactiveSelectionBackground": "#7C6FE012",
      "editor.lineHighlightBackground": "#141414",
      "editor.lineHighlightBorder": "#1C1C1C",
      "editorIndentGuide.background1": "#1E1E1E",
      "editorIndentGuide.activeBackground1": "#303030",
      "editorWhitespace.foreground": "#1C1C1C",
      "editorWidget.background": "#141414",
      "editorWidget.border": "#2A2A2A",
      "editorWidget.foreground": "#EDEDEB",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#FFFFFF0A",
      "scrollbarSlider.hoverBackground": "#FFFFFF18",
      "scrollbarSlider.activeBackground": "#FFFFFF28",
      "editorOverviewRuler.border": "#00000000",
      "focusBorder": "#7C6FE040",
      "editorError.foreground": "#E05252",
      "editorWarning.foreground": "#C4A35A",
    },
  });
}

// ─── Renderer components imported from @/components/form-renderer ────────────
// evalCondition, INPUT_CLS, DynamicField, RenderStatements are all editor-free
// and shared with the public respondent page. See components/form-renderer/index.tsx.

// ─── Dynamic Preview Panel ────────────────────────────────────────────────────

function PreviewPanel({
  ast,
  source,
  compilePhase,
}: {
  ast: ASTNode | null;
  source: string;
  compilePhase: CompilePhase;
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const prevFormName = useRef<string>("");

  useEffect(() => {
    const name = (ast?.name as string) ?? source.match(/form\s+"([^"]+)"/)?.[1] ?? "";
    if (name !== prevFormName.current) {
      prevFormName.current = name;
      setFormValues({});
    }
  }, [ast, source]);

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const isError = compilePhase === "error";
  const isParsing = compilePhase === "parsing" || compilePhase === "semantic";

  const allStatements = useMemo<ASTNode[]>(() => {
    if (!ast) return [];
    const pages = (ast.pages as ASTNode[]) ?? [];
    const stmts = (ast.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [ast]);

  const fallbackTitle = useMemo(
    () => source.match(/form\s+"([^"]+)"/)?.[1] ?? "Untitled Form",
    [source]
  );
  const formTitle = (ast?.name as string) ?? fallbackTitle;
  const action = ast?.action as ASTNode | undefined;

  const statusMap = {
    idle:     { text: "Idle",         dot: "bg-[#3A3A3A]",                color: "text-[#555555]" },
    parsing:  { text: "Parsing...",   dot: "bg-[#C4A35A] animate-pulse",  color: "text-[#C4A35A]" },
    semantic: { text: "Analyzing...", dot: "bg-[#C4A35A] animate-pulse",  color: "text-[#C4A35A]" },
    valid:    { text: "Render Ready", dot: "bg-[#7C6FE0]",                color: "text-[#7C6FE0]" },
    error:    { text: "Parse Error",  dot: "bg-[#E05252]",                color: "text-[#E05252]" },
  };
  const status = statusMap[compilePhase];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F3EE]">
      {/* Header */}
      <div className="flex h-9 flex-none items-center justify-between border-b border-[#DDD5C0] bg-[#EDEAE2] px-4">
        <span className="font-inter text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7060]">
          Live Preview
        </span>
        <div className={`flex items-center gap-1.5 ${status.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          <span className="font-inter text-[10px] font-medium">{status.text}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {isError ? (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="flex h-full min-h-[200px] items-center justify-center"
            >
              <div className="flex max-w-xs flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F0CECE] bg-[#FDF0F0]">
                  <AlertCircle className="h-5 w-5 text-[#E05252]" />
                </div>
                <div>
                  <p className="font-inter text-[13px] font-semibold text-[#1A1410]">Compile Error</p>
                  <p className="mt-1 font-inter text-[11px] leading-relaxed text-[#7A7060]">
                    Fix errors in the editor — the preview updates automatically.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: isParsing ? 0.4 : 1 }}
              transition={{ duration: 0.15 }}
              className="mx-auto w-full max-w-[380px]"
            >
              <div className="overflow-hidden rounded-lg border border-[#D4CCB8] bg-[#FAF8F2] shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                {/* Card header */}
                <div className="border-b border-[#E4DCD0] bg-[#F0EDE5] px-6 py-5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded border border-[#7C6FE0]/30 bg-[#7C6FE0]/10 px-2 py-0.5 font-inter text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7C6FE0]">
                      Live
                    </span>
                    {allStatements.length > 0 && (
                      <span className="font-inter text-[10px] text-[#9A9080]">
                        {allStatements.filter((s) => s.type === "Field").length} fields
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2.5 font-inter text-[20px] font-bold tracking-tight text-[#1A1410]">
                    {formTitle}
                  </h2>
                </div>

                {/* Dynamic form body */}
                <div className="space-y-5 px-6 py-6">
                  {allStatements.length > 0 ? (
                    <RenderStatements
                      stmts={allStatements}
                      values={formValues}
                      onChange={handleChange}
                    />
                  ) : (
                    <p className="font-inter text-[11px] text-[#B4AA96]">
                      Parsing form...
                    </p>
                  )}
                </div>

                {/* Submit footer */}
                <div className="border-t border-[#E4DCD0] px-6 py-4">
                  <button
                    type="button"
                    className="w-full rounded-md bg-[#7C6FE0] py-2.5 font-inter text-[12px] font-semibold text-white transition-all duration-150 hover:bg-[#6B5FD0] active:scale-[0.98]"
                  >
                    Submit Form
                  </button>
                  {action && (
                    <p className="mt-2.5 text-center font-inter text-[9px] text-[#B4AA96]">
                      {action.method as string} · {action.endpoint as string}
                    </p>
                  )}
                </div>
              </div>

              {/* Repeat group hint */}
              {allStatements.some((s) => s.type === "RepeatGroup") && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#DDD5C0] bg-[#F0EDE5] px-3 py-2.5">
                  <Zap className="mt-0.5 h-3 w-3 flex-none text-[#7C6FE0]" />
                  <p className="font-inter text-[10px] leading-relaxed text-[#7A7060]">
                    This form uses <strong className="text-[#3D3528]">repeat groups</strong> — enter a number in the count field and new sections appear dynamically.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActivityBtn({ active, icon, label, onClick }: {
  active: boolean; icon: ReactNode; label: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`relative flex h-10 w-11 items-center justify-center transition-all duration-150 ${
        active ? "text-[#EDEDEB]" : "text-[#555555] hover:text-[#999999]"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-[#7C6FE0]" />
      )}
      {icon}
    </button>
  );
}

function FileIcon({ type }: { type?: string }) {
  if (type === "forml") return <FileCode2 className="h-3.5 w-3.5 text-[#9090A8]" />;
  if (type === "md")    return <FileText className="h-3.5 w-3.5 text-[#666680]" />;
  return <FileText className="h-3.5 w-3.5 text-[#555566]" />;
}

// ─── Explorer Panel ───────────────────────────────────────────────────────────

function ExplorerPanel({ files, activeFile, onSelectFile, onCreateFile, onDeleteFile }: {
  files: Map<string, VirtualFile>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  function commitCreate() {
    const name = newName.trim();
    if (name) {
      const finalName = name.includes(".") ? name : `${name}.forml`;
      onCreateFile(finalName);
    }
    setCreating(false);
    setNewName("");
  }

  const sortedFiles = useMemo(() => {
    return [...files.values()].sort((a, b) => {
      if (a.fileType === "forml" && b.fileType !== "forml") return -1;
      if (a.fileType !== "forml" && b.fileType === "forml") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  const formlFiles = sortedFiles.filter((f) => f.fileType === "forml");
  const otherFiles = sortedFiles.filter((f) => f.fileType !== "forml");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0D0D0D]">
      <div className="flex h-9 flex-none items-center justify-between px-4">
        <span className="font-inter text-[9px] font-semibold uppercase tracking-[0.2em] text-[#555555]">Explorer</span>
        <button
          type="button"
          title="New File"
          onClick={() => setCreating(true)}
          className="flex h-5 w-5 items-center justify-center rounded text-[#555555] transition-colors hover:text-[#AAAAAA] hover:bg-[#1A1A1A]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-none border-b border-[#252525] px-4 pb-2">
        <span className="font-inter text-[9px] font-medium uppercase tracking-[0.14em] text-[#444444]">Formix Project</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2 space-y-px">
        <FormlFolder
          label="forml-files"
          files={formlFiles}
          activeFile={activeFile}
          hoveredFile={hoveredFile}
          onHover={setHoveredFile}
          onSelect={onSelectFile}
          onDelete={onDeleteFile}
        />

        {otherFiles.map((file) => (
          <FileRow
            key={file.name}
            file={file}
            isActive={file.name === activeFile}
            isHovered={hoveredFile === file.name}
            onMouseEnter={() => setHoveredFile(file.name)}
            onMouseLeave={() => setHoveredFile(null)}
            onSelect={() => onSelectFile(file.name)}
            onDelete={() => onDeleteFile(file.name)}
          />
        ))}

        {creating && (
          <div className="flex items-center gap-1.5 rounded bg-[#1E1E1E] border border-[#7C6FE0]/30 px-2 py-[4px] mt-1">
            <FileCode2 className="h-3.5 w-3.5 flex-none text-[#7C6FE0]" />
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              onBlur={commitCreate}
              placeholder="filename.forml"
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-[#EDEDEB] outline-none placeholder:text-[#444444]"
            />
          </div>
        )}
      </div>

      <div className="flex-none border-t border-[#252525] px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-[#555555]">
          <GitBranch className="h-3 w-3" />
          <span className="font-inter">main</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            <span className="font-inter">{files.size} files</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function FormlFolder({ label, files, activeFile, hoveredFile, onHover, onSelect, onDelete }: {
  label: string; files: VirtualFile[]; activeFile: string; hoveredFile: string | null;
  onHover: (n: string | null) => void; onSelect: (n: string) => void; onDelete: (n: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="group flex w-full items-center gap-1.5 rounded py-[4px] pr-2 text-left text-[12px] text-[#777777] hover:bg-[#1A1A1A] hover:text-[#BBBBBB] transition-all duration-150"
        style={{ paddingLeft: "8px" }}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex-none">
          <ChevronRight className="h-3 w-3 text-[#555555]" />
        </motion.span>
        {open
          ? <FolderOpen className="h-3.5 w-3.5 flex-none text-[#7C6FE0]/70" />
          : <Folder className="h-3.5 w-3.5 flex-none text-[#555566]" />
        }
        <span className="flex-1 truncate font-inter text-[12px]">{label}</span>
        <span className="font-mono text-[9px] text-[#444444]">{files.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {files.map((file) => (
              <FileRow
                key={file.name}
                file={file}
                depth={1}
                isActive={file.name === activeFile}
                isHovered={hoveredFile === file.name}
                onMouseEnter={() => onHover(file.name)}
                onMouseLeave={() => onHover(null)}
                onSelect={() => onSelect(file.name)}
                onDelete={() => onDelete(file.name)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileRow({ file, depth = 0, isActive, isHovered, onMouseEnter, onMouseLeave, onSelect, onDelete }: {
  file: VirtualFile; depth?: number; isActive: boolean; isHovered: boolean;
  onMouseEnter: () => void; onMouseLeave: () => void; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div
      className={`group relative flex w-full items-center gap-1.5 rounded py-[4px] pr-2 text-[12px] transition-all duration-150 ${
        isActive
          ? "bg-[#1E1E2A] text-[#EDEDEB]"
          : "text-[#777777] hover:bg-[#181818] hover:text-[#BBBBBB]"
      }`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="flex-none w-3" />
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="flex-none"><FileIcon type={file.fileType} /></span>
        <span className={`flex-1 truncate font-inter ${isActive ? "text-[#EDEDEB] font-medium" : ""}`}>
          {file.name}
        </span>
      </button>
      {isHovered && (
        <button
          type="button"
          title={`Delete ${file.name}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-none rounded p-0.5 text-[#555555] transition-colors hover:text-[#E05252]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {isActive && !isHovered && (
        <span className="ml-auto h-1.5 w-1.5 flex-none rounded-full bg-[#7C6FE0]" />
      )}
    </div>
  );
}

// ─── Editor Tab Bar ────────────────────────────────────────────────────────────

function EditorTabs({ openTabs, activeTab, files, onTabChange, onTabClose }: {
  openTabs: string[]; activeTab: string; files: Map<string, VirtualFile>;
  onTabChange: (tab: string) => void; onTabClose: (tab: string) => void;
}) {
  return (
    <div className="flex h-9 flex-none items-stretch border-b border-[#252525] bg-[#0D0D0D] overflow-x-auto">
      {openTabs.map((name) => {
        const active = activeTab === name;
        const fileType = files.get(name)?.fileType;
        return (
          <div
            key={name}
            className={`relative flex flex-none items-center gap-1.5 border-r border-[#252525] px-3 font-inter text-[11px] transition-all duration-150 max-w-[180px] ${
              active
                ? "bg-[#141414] text-[#EDEDEB]"
                : "text-[#555555] hover:bg-[#121212] hover:text-[#999999]"
            }`}
          >
            {active && (
              <span className="absolute inset-x-0 top-0 h-[2px] bg-[#7C6FE0]" />
            )}
            <button type="button" onClick={() => onTabChange(name)} className="flex min-w-0 items-center gap-1.5 flex-1 py-2">
              <FileIcon type={fileType} />
              <span className="truncate">{name}</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTabClose(name); }}
              className={`flex-none rounded p-0.5 transition-colors ${
                active ? "text-[#555555] hover:text-[#AAAAAA]" : "text-[#333333] hover:text-[#777777]"
              }`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compiler Badge ────────────────────────────────────────────────────────────

function CompilerBadge({ phase }: { phase: CompilePhase }) {
  const configs: Record<CompilePhase, { text: string; color: string; icon: ReactNode } | null> = {
    idle: null,
    parsing:  { text: "Parsing...",          color: "bg-[#1A1A1A] text-[#AAAAAA] border-[#2E2E2E]",   icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    semantic: { text: "Semantic Analysis...", color: "bg-[#1A1A1A] text-[#AAAAAA] border-[#2E2E2E]",   icon: <Zap className="h-3 w-3" /> },
    valid:    { text: "Compiled ✓",           color: "bg-[#141420] text-[#7C6FE0] border-[#2A2540]",   icon: <CheckCircle2 className="h-3 w-3" /> },
    error:    { text: "Compile Error",        color: "bg-[#1E0E0E] text-[#E05252] border-[#3D1A1A]",   icon: <AlertCircle className="h-3 w-3" /> },
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
          className={`pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded border px-2.5 py-1 font-inter text-[10px] font-medium ${config.color}`}
        >
          {config.icon}
          {config.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Editor Panel ──────────────────────────────────────────────────────────────

function EditorPanel({ openTabs, activeTab, files, compilePhase, onTabChange, onTabClose,
  onContentChange, onCursorChange, editorRef, monacoRef, diagnostics }: {
  openTabs: string[]; activeTab: string; files: Map<string, VirtualFile>; compilePhase: CompilePhase;
  onTabChange: (tab: string) => void; onTabClose: (tab: string) => void;
  onContentChange: (name: string, value: string) => void;
  onCursorChange: (cursor: CursorState) => void;
  editorRef: React.MutableRefObject<MonacoEditorNS.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<MonacoLike | null>;
  diagnostics: FormlDiagnostic[];
}) {
  const activeFile = files.get(activeTab);
  const isForml = activeFile?.fileType === "forml";

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
    }));
    monaco.editor.setModelMarkers(model, "forml-compiler", markers);
  }, [diagnostics, editorRef, monacoRef]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0D0D0D]">
      <EditorTabs openTabs={openTabs} activeTab={activeTab} files={files}
        onTabChange={onTabChange} onTabClose={onTabClose} />
      <div className="relative min-h-0 flex-1">
        {openTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileCode2 className="mx-auto h-8 w-8 text-[#252525]" />
              <p className="mt-3 font-inter text-[11px] text-[#444444]">Select a file to open</p>
            </div>
          </div>
        ) : (
          <MonacoEditor
            key={activeTab}
            beforeMount={(monaco) => { defineFormixMono(monaco as unknown as MonacoLike); }}
            theme="formix-mono"
            language={isForml ? "forml" : "markdown"}
            value={activeFile?.content ?? ""}
            onChange={(value) => { if (isForml) onContentChange(activeTab, value ?? ""); }}
            onMount={(editor, monaco) => {
              editorRef.current = editor as MonacoEditorNS.IStandaloneCodeEditor;
              monacoRef.current = monaco as unknown as MonacoLike;
              monaco.editor.setTheme("formix-mono");
              editor.updateOptions(MONACO_OPTIONS);
              editor.onDidChangeCursorPosition((event) => {
                onCursorChange({ line: event.position.lineNumber, column: event.position.column });
              });
            }}
            options={{ ...MONACO_OPTIONS, readOnly: !isForml, domReadOnly: !isForml }}
          />
        )}
        {isForml && <CompilerBadge phase={compilePhase} />}
      </div>
    </div>
  );
}

// ─── Diagnostics Panel ────────────────────────────────────────────────────────

const DIAG_TABS: Array<{ id: DiagTab; label: string }> = [
  { id: "problems",  label: "Problems" },
  { id: "ast",       label: "AST" },
  { id: "json",      label: "JSON Schema" },
  { id: "tokens",    label: "Tokens" },
];

function DiagnosticsContent({ tab, compileResult, activeFile }: {
  tab: DiagTab; compileResult: FormlCompileResult | null; activeFile: string;
}) {
  if (tab === "problems") {
    const diags = compileResult?.diagnostics ?? [];
    const errors   = diags.filter((d) => d.severity === "error");
    const warnings = diags.filter((d) => d.severity === "warning");
    if (diags.length === 0)
      return (
        <div className="flex items-center gap-2 p-4 text-[#555555]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#4ADE80]" />
          <span className="font-inter text-[11px]">No problems detected</span>
        </div>
      );
    return (
      <div className="space-y-1 p-4">
        {[...errors, ...warnings].map((d, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-[#141414]">
            {d.severity === "error"
              ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-[#E05252]" />
              : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-[#C4A35A]" />}
            <div>
              <p className={`font-inter text-[11px] ${d.severity === "error" ? "text-[#E05252]" : "text-[#C4A35A]"}`}>
                {d.message}
              </p>
              <p className="mt-0.5 font-inter text-[10px] text-[#555555]">
                {activeFile} · Line {d.line}, Col {d.col}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "ast") {
    return (
      <pre className="p-4 font-mono text-[10px] leading-relaxed text-[#9A9AAA] overflow-auto">
        {compileResult?.ast ? JSON.stringify(compileResult.ast, null, 2) : "// No AST — fix compile errors first."}
      </pre>
    );
  }
  if (tab === "json") {
    const ast = compileResult?.ast as ASTNode | null;
    if (!ast) return <pre className="p-4 font-mono text-[10px] text-[#444444]">// No schema — fix compile errors first.</pre>;
    const stmts = ((ast.statements as ASTNode[]) ?? []).filter((s) => s.type === "Field");
    const schema = {
      $schema: "https://formix.dev/schema/v1",
      title: ast.name,
      fields: stmts.map((s) => {
        const ui = s.ui as ASTNode | undefined;
        return { name: s.name, type: s.fieldType, label: ui?.label ?? s.name, placeholder: ui?.placeholder, helpText: ui?.helpText, options: (s.options as string[])?.length ? s.options : undefined };
      }),
    };
    return (
      <pre className="p-4 font-mono text-[10px] leading-relaxed text-[#9A9AAA] overflow-auto">
        {JSON.stringify(schema, null, 2)}
      </pre>
    );
  }
  if (tab === "tokens") {
    const ast = compileResult?.ast as ASTNode | null;
    if (!ast) return <pre className="p-4 font-mono text-[10px] text-[#444444]">// Compile to see tokens.</pre>;
    const stmts = ((ast.statements as ASTNode[]) ?? []).filter((s) => s.type === "Field");
    const tokens = [
      { token: "form",          type: "KEYWORD" },
      { token: `"${ast.name}"`, type: "STRING" },
      { token: "{",             type: "LBRACE" },
      ...stmts.flatMap((s) => [
        { token: "field",           type: "KEYWORD" },
        { token: s.name as string,  type: "IDENTIFIER" },
        { token: ":",               type: "COLON" },
        { token: s.fieldType as string, type: "TYPE_KEYWORD" },
      ]),
      { token: "}", type: "RBRACE" },
    ];
    return (
      <div className="overflow-auto">
        <table className="w-full font-mono text-[10px]">
          <thead>
            <tr className="border-b border-[#252525]">
              {["#", "Token", "Type"].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-[#444444]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((tok, i) => (
              <tr key={i} className="border-b border-[#141414] transition-colors hover:bg-[#141414]">
                <td className="px-4 py-1.5 text-[#444444]">{i}</td>
                <td className="px-4 py-1.5 text-[#AAAAAA]">{tok.token}</td>
                <td className="px-4 py-1.5 text-[#7C6FE0]">{tok.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

function DiagnosticsPanel({ open, onToggle, compileResult, activeFile }: {
  open: boolean; onToggle: () => void; compileResult: FormlCompileResult | null; activeFile: string;
}) {
  const [activeTab, setActiveTab] = useState<DiagTab>("problems");
  const errorCount = compileResult?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const warnCount  = compileResult?.diagnostics.filter((d) => d.severity === "warning").length ?? 0;

  return (
    <div className="flex-none">
      <motion.div
        initial={false}
        animate={{ height: open ? 240 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="overflow-hidden border-t border-[#252525] bg-[#0D0D0D]"
      >
        <div className="flex h-9 items-center border-b border-[#252525]">
          {DIAG_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative flex h-full items-center gap-1.5 px-4 font-inter text-[10px] transition-colors duration-150 ${
                activeTab === t.id ? "text-[#EDEDEB]" : "text-[#555555] hover:text-[#999999]"
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
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto flex h-full w-9 items-center justify-center text-[#444444] transition-colors hover:text-[#888888]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="h-[calc(240px-36px)] overflow-auto">
          <DiagnosticsContent tab={activeTab} compileResult={compileResult} activeFile={activeFile} />
        </div>
      </motion.div>
    </div>
  );
}

// ─── Status Bar ────────────────────────────────────────────────────────────────

function StatusBar({ compilePhase, cursor, onToggleDiag, compileMs, wasmReady }: {
  compilePhase: CompilePhase; cursor: CursorState;
  onToggleDiag: () => void; compileMs: number | null; wasmReady: boolean;
}) {
  const isError   = compilePhase === "error";
  const isValid   = compilePhase === "valid";
  const isParsing = compilePhase === "parsing" || compilePhase === "semantic";

  return (
    <div className="flex h-6 flex-none items-center justify-between border-t border-[#252525] bg-[#0D0D0D] px-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleDiag}
          title="Toggle Diagnostics Panel"
          className="flex items-center gap-1 text-[#555555] transition-colors hover:text-[#AAAAAA]"
        >
          <Terminal className="h-2.5 w-2.5" />
          <span className="font-inter text-[9px]">Console</span>
        </button>
        <span className="h-3 w-px bg-[#2A2A2A]" />

        {!wasmReady && (
          <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#555555]">
            <Loader2 className="h-2 w-2 animate-spin" />WASM loading...
          </span>
        )}
        {wasmReady && isParsing && (
          <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#888888]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C4A35A] animate-pulse" />Compiling...
          </span>
        )}
        {wasmReady && isValid && (
          <div className="flex items-center gap-2.5">
            <span className="font-inter text-[9px] text-[#7C6FE0]">✓ Parser</span>
            <span className="h-3 w-px bg-[#2A2A2A]" />
            <span className="font-inter text-[9px] text-[#7C6FE0]">✓ AST</span>
            <span className="h-3 w-px bg-[#2A2A2A]" />
            <span className="font-inter text-[9px] text-[#7C6FE0]">✓ Semantic</span>
            {compileMs !== null && (
              <>
                <span className="h-3 w-px bg-[#2A2A2A]" />
                <span className="font-inter text-[9px] text-[#666666]">{compileMs} ms</span>
              </>
            )}
          </div>
        )}
        {wasmReady && isError && (
          <span className="flex items-center gap-1 font-inter text-[9px] text-[#E05252]">
            <TriangleAlert className="h-2.5 w-2.5" />Compile error
          </span>
        )}
        {wasmReady && compilePhase === "idle" && (
          <span className="font-inter text-[9px] text-[#555555]">WASM ready · C++ compiler active</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="font-inter text-[9px] text-[#666666]">Ln {cursor.line}, Col {cursor.column}</span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="font-inter text-[9px] text-[#555555]">UTF-8</span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="flex items-center gap-1 font-inter text-[9px] text-[#555555]">
          <GitBranch className="h-2 w-2" />main
        </span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#555555]">
          <span className={`h-1.5 w-1.5 rounded-full ${wasmReady ? "bg-[#4ADE80]" : "bg-[#C4A35A] animate-pulse"}`} />
          {wasmReady ? "WASM active" : "Loading..."}
        </span>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

// ─── Publish Modal ────────────────────────────────────────────────────────────

function PublishModal({ url, embed, onClose }: {
  url: string;
  embed: string;
  onClose: () => void;
}) {
  const [copiedUrl,   setCopiedUrl]   = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const copy = (text: string, setFlag: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-xl border border-[#252535] bg-[#111118] p-6 shadow-2xl mx-4"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded text-[#555555] transition-colors hover:bg-[#1E1E2A] hover:text-[#AAAAAA]"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#7C6FE0]/30 bg-[#7C6FE0]/10">
            <Globe className="h-4 w-4 text-[#7C6FE0]" />
          </div>
          <div>
            <p className="font-inter text-[14px] font-semibold text-[#EDEDEB]">Form Published</p>
            <p className="font-inter text-[11px] text-[#555555]">Share the link or embed it anywhere</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Public URL */}
          <div>
            <p className="mb-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.14em] text-[#555555]">
              Public Link
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-[#252525] bg-[#0D0D0D] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#EDEDEB]">{url}</span>
              <button
                type="button"
                onClick={() => copy(url, setCopiedUrl)}
                className="flex flex-none items-center gap-1 rounded border border-[#333333] bg-[#1A1A1A] px-2 py-1 font-inter text-[9px] text-[#999999] transition-colors hover:border-[#7C6FE0]/50 hover:text-[#7C6FE0]"
              >
                {copiedUrl ? "Copied!" : <><Copy className="h-2.5 w-2.5" /> Copy</>}
              </button>
            </div>
          </div>

          {/* Embed snippet */}
          <div>
            <p className="mb-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.14em] text-[#555555]">
              Embed Snippet
            </p>
            <div className="rounded-lg border border-[#252525] bg-[#0D0D0D] px-3 py-3">
              <pre className="overflow-x-auto whitespace-pre font-mono text-[10px] leading-relaxed text-[#9A9AAA]">{embed}</pre>
            </div>
            <button
              type="button"
              onClick={() => copy(embed, setCopiedEmbed)}
              className="mt-2 flex items-center gap-1.5 rounded border border-[#333333] bg-[#1A1A1A] px-2.5 py-1.5 font-inter text-[9px] text-[#999999] transition-colors hover:border-[#7C6FE0]/50 hover:text-[#7C6FE0]"
            >
              <Copy className="h-2.5 w-2.5" />
              {copiedEmbed ? "Copied!" : "Copy Snippet"}
            </button>
          </div>

          {/* Open link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7C6FE0] py-2.5 font-inter text-[12px] font-semibold text-white transition-all hover:bg-[#8A7DF0]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Form in New Tab
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ activeFile, compilePhase, wasmReady, onManualCompile, onPublish, publishState }: {
  activeFile: string;
  compilePhase: CompilePhase;
  wasmReady: boolean;
  onManualCompile: () => void;
  onPublish: () => void;
  publishState: PublishState;
}) {
  const phaseLabel = {
    idle:     wasmReady ? "Ready" : "Loading...",
    parsing:  "Parsing...",
    semantic: "Analyzing...",
    valid:    "Compiled",
    error:    "Error",
  };
  const phaseDot = {
    idle:     wasmReady ? "bg-[#4ADE80]" : "bg-[#C4A35A] animate-pulse",
    parsing:  "bg-[#C4A35A] animate-pulse",
    semantic: "bg-[#C4A35A] animate-pulse",
    valid:    "bg-[#7C6FE0]",
    error:    "bg-[#E05252]",
  };
  const phaseTextColor = {
    idle:     wasmReady ? "text-[#666666]" : "text-[#666666]",
    parsing:  "text-[#888888]",
    semantic: "text-[#888888]",
    valid:    "text-[#7C6FE0]",
    error:    "text-[#E05252]",
  };

  return (
    <div className="flex h-10 flex-none items-center justify-between border-b border-[#252525] bg-[#0D0D0D] px-4">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded border border-[#2D2D3D] bg-[#141420]">
            <span className="font-inter text-[9px] font-black tracking-tighter text-[#7C6FE0]">FX</span>
          </div>
          <span className="font-inter text-[12px] font-semibold tracking-tight text-[#EDEDEB]">Formix</span>
        </div>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <div className="flex items-center gap-1 font-inter text-[11px]">
          <span className="text-[#555555]">my-project</span>
          <ChevronRight className="h-3 w-3 text-[#3A3A3A]" />
          <span className="text-[#999999]">{activeFile}</span>
        </div>
      </div>

      {/* Right: status + run button + publish button */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 ${phaseTextColor[compilePhase]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${phaseDot[compilePhase]}`} />
          <span className="font-inter text-[10px] font-medium">{phaseLabel[compilePhase]}</span>
        </div>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <button
          type="button"
          onClick={onManualCompile}
          disabled={!wasmReady}
          className="flex items-center gap-1.5 rounded-md bg-[#7C6FE0] px-3 py-1.5 font-inter text-[10px] font-semibold text-white transition-all duration-150 hover:bg-[#8A7DF0] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Zap className="h-3 w-3" />
          Run
        </button>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <button
          type="button"
          id="publish-btn"
          onClick={onPublish}
          disabled={!wasmReady || publishState === "publishing" || compilePhase !== "valid"}
          title={compilePhase !== "valid" ? "Fix compile errors before publishing" : "Publish form"}
          className="flex items-center gap-1.5 rounded-md border border-[#7C6FE0]/50 px-3 py-1.5 font-inter text-[10px] font-semibold text-[#7C6FE0] transition-all duration-150 hover:bg-[#7C6FE0]/10 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {publishState === "publishing"
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Globe className="h-3 w-3" />
          }
          {publishState === "publishing" ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}

function PartitionHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-[3px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
      <span className="h-full w-px bg-[#252525] transition-all duration-150 group-hover:bg-[#7C6FE0]/40 group-hover:w-[2px]" />
    </PanelResizeHandle>
  );
}

// ─── Main Shell ────────────────────────────────────────────────────────────────

export function DemoIdeShell() {
  const { ready: wasmReady, compile } = useFormlCompiler();

  const fsStore = useMemo(() => getFileSystemStore(), []);
  const [files, setFiles] = useState<Map<string, VirtualFile>>(() => fsStore.files);

  useEffect(() => {
    const unsub = fsStore.subscribe((updated) => setFiles(new Map(updated)));
    return unsub;
  }, [fsStore]);

  const [openTabs,      setOpenTabs]      = useState<string[]>(() => ["customer-feedback.forml"]);
  const [activeTab,     setActiveTab]     = useState("customer-feedback.forml");
  const [compilePhase,  setCompilePhase]  = useState<CompilePhase>("idle");
  const [compileResult, setCompileResult] = useState<FormlCompileResult | null>(null);
  const [compileMs,     setCompileMs]     = useState<number | null>(null);
  const [cursor,        setCursor]        = useState<CursorState>({ line: 1, column: 1 });
  const [diagOpen,      setDiagOpen]      = useState(false);
  const [activeTool,    setActiveTool]    = useState<SidebarTool>("files");

  const editorRef    = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef    = useRef<MonacoLike | null>(null);
  const phaseTimers  = useRef<number[]>([]);

  // ── Publish state ──────────────────────────────────────────────────────────
  const [publishState,   setPublishState]   = useState<PublishState>("idle");
  const [publishedUrl,   setPublishedUrl]   = useState<string | null>(null);
  const [publishedEmbed, setPublishedEmbed] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  /** Get the backend form ID persisted for this filename in localStorage. */
  const getFormId = useCallback((filename: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`formix_form_id_${filename}`) ?? null;
  }, []);

  /** Persist the backend form ID for this filename in localStorage. */
  const saveFormId = useCallback((filename: string, id: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`formix_form_id_${filename}`, id);
    }
  }, []);

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach((id) => window.clearTimeout(id));
    phaseTimers.current = [];
  }, []);

  const activeFile    = files.get(activeTab);
  const isFormlActive = activeFile?.fileType === "forml";

  const runCompile = useCallback((source: string) => {
    if (!wasmReady) return;
    clearPhaseTimers();
    setCompilePhase("parsing");
    const t1 = window.setTimeout(() => setCompilePhase("semantic"), 120);
    const t2 = window.setTimeout(() => {
      const result = compile(source);
      setCompileResult(result);
      setCompilePhase(result.ok ? "valid" : "error");
      setCompileMs(result.durationMs);
      if (!result.ok && result.diagnostics.some((d) => d.severity === "error")) setDiagOpen(true);
    }, 280);
    phaseTimers.current = [t1, t2];
  }, [wasmReady, compile, clearPhaseTimers]);

  useEffect(() => {
    if (!isFormlActive) { setCompilePhase("idle"); setCompileResult(null); return; }
    if (activeFile) runCompile(activeFile.content);
    return clearPhaseTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, wasmReady, isFormlActive]);

  const editTimerRef = useRef<number | null>(null);
  const handleContentChange = useCallback((name: string, value: string) => {
    fsStore.update(name, value);
    if (!isFormlActive) return;
    if (editTimerRef.current) window.clearTimeout(editTimerRef.current);
    editTimerRef.current = window.setTimeout(() => runCompile(value), 500);
  }, [fsStore, isFormlActive, runCompile]);

  const handleSelectFile = useCallback((name: string) => {
    if (!openTabs.includes(name)) setOpenTabs((prev) => [...prev, name]);
    setActiveTab(name);
  }, [openTabs]);

  const handleTabClose = useCallback((name: string) => {
    const newTabs = openTabs.filter((t) => t !== name);
    setOpenTabs(newTabs);
    if (activeTab === name) setActiveTab(newTabs[newTabs.length - 1] ?? "");
  }, [openTabs, activeTab]);

  const handleCreateFile = useCallback((name: string) => {
    try {
      const title = name.replace(".forml", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const content = name.endsWith(".forml") ? newFormlTemplate(title) : "";
      fsStore.create(name, content);
      handleSelectFile(name);
    } catch { handleSelectFile(name); }
  }, [fsStore, handleSelectFile]);

  const handleDeleteFile = useCallback((name: string) => {
    fsStore.delete(name);
    handleTabClose(name);
  }, [fsStore, handleTabClose]);

  const handleManualCompile = useCallback(() => {
    if (activeFile && isFormlActive) runCompile(activeFile.content);
  }, [activeFile, isFormlActive, runCompile]);

  /**
   * Publish the current file:
   * 1. Compile the source (must be valid).
   * 2. Create or update the form record in the backend.
   * 3. Call POST /forms/{id}/publish with the compiled schema.
   * 4. Show the PublishModal with the returned URL + embed snippet.
   */
  const handlePublish = useCallback(async () => {
    if (!activeFile || !isFormlActive || !wasmReady) return;

    const result = compile(activeFile.content);
    if (!result.ok || !result.ast) {
      // Surface compile errors before user tries to publish.
      setDiagOpen(true);
      return;
    }

    setPublishState("publishing");
    try {
      let formId = getFormId(activeTab);

      const schemaTitle =
        (result.ast.name as string) ??
        activeTab.replace(".forml", "").replace(/-/g, " ");

      if (!formId) {
        // First publish: create the form record in the backend.
        const created = await createForm({
          title: schemaTitle,
          forml_source: activeFile.content,
          compiled_schema: result.ast,
        });
        formId = created.id;
        saveFormId(activeTab, formId);
      } else {
        // Subsequent publish: update source + schema, then publish.
        await updateForm(formId, {
          forml_source: activeFile.content,
          compiled_schema: result.ast,
        });
      }

      const published = await publishForm(
        formId,
        result.ast,
        window.location.origin,
      );

      setPublishedUrl(published.public_url);
      setPublishedEmbed(published.embed_snippet);
      setPublishState("done");
      setShowPublishModal(true);
    } catch (err) {
      console.error("[Formix] Publish failed:", err);
      setPublishState("error");
    }
  }, [
    activeFile, isFormlActive, wasmReady, compile,
    activeTab, getFormId, saveFormId,
  ]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#0D0D0D] font-inter text-[#EDEDEB]">
      <TopBar
        activeFile={activeTab || "—"}
        compilePhase={compilePhase}
        wasmReady={wasmReady}
        onManualCompile={handleManualCompile}
        onPublish={handlePublish}
        publishState={publishState}
      />

      <div className="flex min-h-0 flex-1">
        {/* Activity Bar */}
        <aside className="flex w-11 flex-none flex-col items-center border-r border-[#252525] bg-[#0D0D0D] py-2">
          <ActivityBtn
            active={activeTool === "files"}
            icon={<Files className="h-4 w-4" />}
            label="Files"
            onClick={() => setActiveTool("files")}
          />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <PanelGroup direction="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize={18} minSize={14} maxSize={30}>
              <ExplorerPanel
                files={files}
                activeFile={activeTab}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
              />
            </Panel>

            <PartitionHandle />

            <Panel defaultSize={50} minSize={28}>
              <EditorPanel
                openTabs={openTabs}
                activeTab={activeTab}
                files={files}
                compilePhase={compilePhase}
                onTabChange={setActiveTab}
                onTabClose={handleTabClose}
                onContentChange={handleContentChange}
                onCursorChange={setCursor}
                editorRef={editorRef}
                monacoRef={monacoRef}
                diagnostics={compileResult?.diagnostics ?? []}
              />
            </Panel>

            <PartitionHandle />

            <Panel defaultSize={32} minSize={20}>
              <PreviewPanel
                ast={compileResult?.ast ?? null}
                source={activeFile?.content ?? ""}
                compilePhase={compilePhase}
              />
            </Panel>
          </PanelGroup>

          <DiagnosticsPanel
            open={diagOpen}
            onToggle={() => setDiagOpen((p) => !p)}
            compileResult={compileResult}
            activeFile={activeTab}
          />
        </div>
      </div>

      <StatusBar
        compilePhase={compilePhase}
        cursor={cursor}
        onToggleDiag={() => setDiagOpen((p) => !p)}
        compileMs={compileMs}
        wasmReady={wasmReady}
      />

      {/* Publish success modal */}
      <AnimatePresence>
        {showPublishModal && publishedUrl && publishedEmbed && (
          <PublishModal
            url={publishedUrl}
            embed={publishedEmbed}
            onClose={() => {
              setShowPublishModal(false);
              setPublishState("idle");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
