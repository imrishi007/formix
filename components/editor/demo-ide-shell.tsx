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
  Code2,
  Columns2,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Files,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  Globe,
  Loader2,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Terminal,
  Trash2,
  TriangleAlert,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { AIChatPanel } from "@/components/editor/ai-chat-panel";

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
  defineFormixMono,
  MONACO_OPTIONS,
  type MonacoLike,
} from "@/lib/monaco-forml";
import { registerFormlLanguageService } from "@/lib/monaco-forml-language";
import {
  evalCondition,
  INPUT_CLS,
  DynamicField,
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";
import { useFormValidation } from "@/hooks/use-form-validation";
import { createForm, updateForm, publishForm } from "@/lib/api";
import { MarkdownPreview } from "@/components/editor/markdown-preview";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarTool = "files" | "ai";
type CompilePhase = "idle" | "parsing" | "semantic" | "valid" | "error";
type DiagTab = "problems" | "ast" | "json" | "tokens";
type PublishState = "idle" | "publishing" | "done" | "error";
type MarkdownView = "code" | "preview" | "split";
// ASTNode is imported from @/components/form-renderer

interface CursorState { line: number; column: number; }

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

// ─── Renderer components imported from @/components/form-renderer ────────────
// evalCondition, INPUT_CLS, DynamicField, RenderStatements are all editor-free
// and shared with the public respondent page. See components/form-renderer/index.tsx.
// Monaco theme, tokenizer, options, and the MonacoLike typing live in
// lib/monaco-forml.ts so both this editor and the compiler playground share them.

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

  // Flatten AST into a flat statement list for rendering + validation.
  const allStatements = useMemo<ASTNode[]>(() => {
    if (!ast) return [];
    const pages = (ast.pages as ASTNode[]) ?? [];
    const stmts = (ast.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [ast]);

  // Pre-touch all fields so authors see validation errors as they type.
  const allFieldKeys = useMemo(() => {
    const keys: string[] = [];
    const collect = (stmts: ASTNode[]) => {
      for (const s of stmts) {
        if ((s.type as string) === "Field") keys.push(s.name as string);
        else if ((s.type as string) === "Section" || (s.type as string) === "Layout")
          collect((s.statements as ASTNode[]) ?? []);
        else if ((s.type as string) === "Conditional") {
          collect((s.then as ASTNode[]) ?? []);
          collect((s.else as ASTNode[]) ?? []);
        }
      }
    };
    collect(allStatements);
    return keys;
  }, [allStatements]);

  const preTouched = useMemo(
    () => Object.fromEntries(allFieldKeys.map((k) => [k, true])),
    [allFieldKeys],
  );

  const { errors } = useFormValidation(allStatements, formValues);

  const isError = compilePhase === "error";
  const isParsing = compilePhase === "parsing" || compilePhase === "semantic";

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
    <div className="flex h-full min-h-0 flex-col bg-[#151515] text-[#F4F4F5]">
      {/* Header */}
      <div className="flex h-12 flex-none items-center justify-between border-b border-white/[0.06] bg-[#1B1B1B] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8B5CF6]/15 ring-1 ring-[#8B5CF6]/30">
            <span className="font-inter text-[10px] font-bold text-[#C4B5FD]">FX</span>
          </div>
          <div>
            <p className="font-inter text-[12px] font-semibold text-white">Live Preview</p>
            <p className="font-inter text-[10px] text-[#71717A]">Rendered output</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#111111] p-0.5">
            <button type="button" className="rounded-md bg-white/[0.08] px-2.5 py-1 font-inter text-[10px] font-medium text-white shadow-sm">UI</button>
            <button type="button" className="rounded-md px-2.5 py-1 font-inter text-[10px] text-[#71717A] transition-colors hover:text-white">AST</button>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#111111] px-2.5 py-1 ${status.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <span className="font-inter text-[10px] font-medium">{status.text}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="min-h-0 flex-1 overflow-auto bg-[#111111] p-6">
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
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#FAFAF9] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                {/* Card header */}
                <div className="border-b border-black/[0.06] bg-white px-6 py-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2.5 py-1 font-inter text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7C3AED]">
                      Live
                    </span>
                    {allStatements.length > 0 && (
                      <span className="font-inter text-[10px] text-[#9A9080]">
                        {allStatements.filter((s) => s.type === "Field").length} fields
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-inter text-[22px] font-bold tracking-tight text-[#18181B]">
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
                      errors={errors}
                      touched={preTouched}
                    />
                  ) : (
                    <p className="font-inter text-[11px] text-[#B4AA96]">
                      Parsing form...
                    </p>
                  )}
                </div>

                {/* Submit footer */}
                <div className="border-t border-black/[0.06] px-6 py-5">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-[#8B5CF6] py-3 font-inter text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(139,92,246,0.22)] transition-all duration-150 hover:bg-[#7C3AED] active:scale-[0.98]"
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
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.08] bg-[#1B1B1B] shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <div className="flex h-14 flex-none items-center justify-between px-5">
        <span className="font-inter text-[12px] font-semibold text-[#F4F4F5]">Explorer</span>
        <div className="flex items-center gap-1">
          <button type="button" title="Search files" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white"><Search className="h-3.5 w-3.5" /></button>
          <button type="button" title="New File" onClick={() => setCreating(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="mx-4 flex h-9 flex-none items-center rounded-lg border border-white/[0.06] bg-[#111111] px-3">
        <FolderOpen className="mr-2 h-3.5 w-3.5 text-[#8B5CF6]" />
        <span className="font-inter text-[11px] font-medium text-[#A1A1AA]">Formix Project</span>
      </div>

      <div className="formix-scroll min-h-0 flex-1 overflow-auto px-3 py-4 space-y-1">
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

      <div className="flex-none border-t border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] text-[#71717A]">
          <GitBranch className="h-3 w-3" />
          <span className="font-inter">main</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
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
        className="group flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left text-[12px] text-[#A1A1AA] hover:bg-white/[0.05] hover:text-white transition-all duration-150"
        style={{ paddingLeft: "8px" }}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex-none">
          <ChevronRight className="h-3.5 w-3.5 text-[#71717A]" />
        </motion.span>
        {open
          ? <FolderOpen className="h-4 w-4 flex-none text-[#A78BFA]" />
          : <Folder className="h-4 w-4 flex-none text-[#71717A]" />
        }
        <span className="flex-1 truncate font-inter text-[12px]">{label}</span>
        <span className="font-mono text-[10px] text-[#52525B]">{files.length}</span>
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
      className={`group relative flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-[12px] transition-all duration-150 ${
        isActive
          ? "bg-[#8B5CF6]/10 text-[#F4F4F5] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-[#8B5CF6]"
          : "text-[#A1A1AA] hover:bg-white/[0.05] hover:text-white"
      }`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="flex-none w-3" />
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="flex-none"><FileIcon type={file.fileType} /></span>
        <span className={`flex-1 truncate font-inter ${isActive ? "text-white font-medium" : ""}`}>
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
        <span className="ml-auto h-1.5 w-1.5 flex-none rounded-full bg-[#8B5CF6] shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
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
    <div className="formix-scroll flex h-12 flex-none items-stretch border-b border-white/[0.06] bg-[#181818] overflow-x-auto px-2 pt-2">
      {openTabs.map((name) => {
        const active = activeTab === name;
        const fileType = files.get(name)?.fileType;
        return (
          <div
            key={name}
              className={`relative flex flex-none items-center gap-1.5 rounded-t-lg border-r border-white/[0.06] px-4 font-inter text-[12px] transition-all duration-150 max-w-[220px] ${
              active
                ? "bg-[#1E1E1E] text-[#F4F4F5] shadow-[0_-2px_12px_rgba(0,0,0,0.15)]"
                : "text-[#71717A] hover:bg-white/[0.04] hover:text-[#D4D4D8]"
            }`}
          >
            {active && (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[#8B5CF6]" />
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

function MarkdownToolbar({ view, onChange }: { view: MarkdownView; onChange: (view: MarkdownView) => void }) {
  const options: Array<{ id: MarkdownView; label: string; icon: ReactNode }> = [
    { id: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: "preview", label: "Preview", icon: <Eye className="h-3.5 w-3.5" /> },
    { id: "split", label: "Split View", icon: <Columns2 className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex h-11 flex-none items-center justify-between border-b border-white/[0.06] bg-[#1B1B1B] px-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[#8B5CF6]/10 px-2 py-1 font-inter text-[10px] font-medium text-[#C4B5FD]">Markdown</span>
        <span className="font-inter text-[10px] text-[#52525B]">GFM enabled</span>
      </div>
      <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#111111] p-0.5">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-inter text-[10px] transition-all ${view === option.id ? "bg-[#8B5CF6]/15 text-[#C4B5FD] shadow-sm" : "text-[#71717A] hover:text-white"}`}>
            {option.icon}{option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Editor Panel ──────────────────────────────────────────────────────────────

function EditorPanel({ openTabs, activeTab, files, compilePhase, onTabChange, onTabClose,
  onContentChange, onCursorChange, editorRef, monacoRef, diagnostics,
  onToggleExplorer, onToggleDiag }: {
  openTabs: string[]; activeTab: string; files: Map<string, VirtualFile>; compilePhase: CompilePhase;
  onTabChange: (tab: string) => void; onTabClose: (tab: string) => void;
  onContentChange: (name: string, value: string) => void;
  onCursorChange: (cursor: CursorState) => void;
  editorRef: React.MutableRefObject<MonacoEditorNS.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<MonacoLike | null>;
  diagnostics: FormlDiagnostic[];
  onToggleExplorer: () => void;
  onToggleDiag: () => void;
}) {
  const activeFile = files.get(activeTab);
  const isForml = activeFile?.fileType === "forml";
  const isMarkdown = activeFile?.fileType === "md";
  const isEditable = isForml || isMarkdown;
  const [markdownView, setMarkdownView] = useState<MarkdownView>("split");

  // Ref that holds ITextModel per file name (model-per-file pattern).
  const modelsRef = useRef<Map<string, MonacoEditorNS.ITextModel>>(new Map());

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
    }));
    monaco.editor.setModelMarkers(model, "forml-compiler", markers);
  }, [diagnostics, editorRef, monacoRef]);

  // Switch the editor to the model for activeTab (no remount).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current as unknown as { editor: { createModel: (v: string, lang: string) => MonacoEditorNS.ITextModel } } | null;
    if (!editor || !monaco) return;

    const file = files.get(activeTab);
    if (!file) return;
    const lang = file.fileType === "forml" ? "forml" : "markdown";

    let model = modelsRef.current.get(activeTab);
    if (!model) {
      model = monaco.editor.createModel(file.content, lang);
      modelsRef.current.set(activeTab, model);
    }
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }
    editor.updateOptions({ readOnly: !isEditable, domReadOnly: !isEditable });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, files, isForml]);

  // Dispose models for tabs that were closed.
  useEffect(() => {
    const openSet = new Set(openTabs);
    modelsRef.current.forEach((model, name) => {
      if (!openSet.has(name)) {
        model.dispose();
        modelsRef.current.delete(name);
      }
    });
  }, [openTabs]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1E1E1E] shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <EditorTabs openTabs={openTabs} activeTab={activeTab} files={files}
        onTabChange={onTabChange} onTabClose={onTabClose} />
      {isMarkdown && <MarkdownToolbar view={markdownView} onChange={setMarkdownView} />}
      <div className={`relative min-h-0 flex-1 ${isMarkdown && markdownView === "split" ? "flex" : ""}`}>
        {openTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileCode2 className="mx-auto h-8 w-8 text-[#252525]" />
              <p className="mt-3 font-inter text-[11px] text-[#444444]">Select a file to open</p>
            </div>
          </div>
        ) : (
          <>
          {(!isMarkdown || markdownView !== "preview") && (
          <div className={isMarkdown && markdownView === "split" ? "min-w-0 flex-1 border-r border-white/[0.08]" : "h-full w-full"}>
          <MonacoEditor
            beforeMount={(monaco) => {
              defineFormixMono(monaco as unknown as MonacoLike);
              registerFormlLanguageService(monaco as unknown as MonacoLike);
            }}
            theme="formix-mono"
            language={isForml ? "forml" : "markdown"}
            value={activeFile?.content ?? ""}
            onChange={(value) => {
              if (isEditable) onContentChange(activeTab, value ?? "");
            }}
            onMount={(editor, monaco) => {
              editorRef.current = editor as MonacoEditorNS.IStandaloneCodeEditor;
              monacoRef.current = monaco as unknown as MonacoLike;
              monaco.editor.setTheme("formix-mono");
              editor.updateOptions(MONACO_OPTIONS);

              // Create initial model for the active tab.
              const file = files.get(activeTab);
              if (file) {
                const lang = file.fileType === "forml" ? "forml" : "markdown";
                const existingModel = (monaco.editor as unknown as { getModels: () => MonacoEditorNS.ITextModel[] }).getModels().find(
                  (m) => m === modelsRef.current.get(activeTab)
                );
                if (!existingModel) {
                  const m = monaco.editor.createModel(file.content, lang);
                  modelsRef.current.set(activeTab, m);
                  editor.setModel(m);
                }
              }

              editor.onDidChangeCursorPosition((event) => {
                onCursorChange({ line: event.position.lineNumber, column: event.position.column });
              });

              // ── Keyboard shortcuts ───────────────────────────────────────
              // Ctrl+S / Cmd+S  — save & compile
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                () => { (document.querySelector('[data-action="run"]') as HTMLButtonElement)?.click(); },
              );
              // Ctrl+Enter / Cmd+Enter — manual compile
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => { (document.querySelector('[data-action="run"]') as HTMLButtonElement)?.click(); },
              );
              // Ctrl+B / Cmd+B — toggle file explorer
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
                () => onToggleExplorer(),
              );
              // Ctrl+J / Cmd+J — toggle diagnostics panel
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ,
                () => onToggleDiag(),
              );

              // Command palette actions
              editor.addAction({
                id: "formix.compile",
                label: "FormL: Compile Current File",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                run: () => { (document.querySelector('[data-action="run"]') as HTMLButtonElement)?.click(); },
              });
              editor.addAction({
                id: "formix.toggleDiagnostics",
                label: "FormL: Toggle Diagnostics Panel",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ],
                run: () => onToggleDiag(),
              });
              editor.addAction({
                id: "formix.toggleExplorer",
                label: "FormL: Toggle File Explorer",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
                run: () => onToggleExplorer(),
              });
            }}
            options={{ ...MONACO_OPTIONS, readOnly: !isEditable, domReadOnly: !isEditable }}
          />
          </div>
          )}
          {isMarkdown && markdownView !== "code" && (
            <div className={markdownView === "split" ? "min-w-0 flex-1" : "h-full w-full"}>
              <MarkdownPreview source={activeFile?.content ?? ""} />
            </div>
          )}
          </>
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
    <div className="flex h-8 flex-none items-center justify-between border-t border-white/[0.06] bg-[#151515] px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleDiag}
          title="Toggle Diagnostics Panel"
          className="flex items-center gap-1 text-[#555555] transition-colors hover:text-[#AAAAAA]"
        >
          <Terminal className="h-2.5 w-2.5" />
          <span className="font-inter text-[10px]">Problems</span>
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
            <span className="font-inter text-[10px] text-[#22C55E]">✓ Parser</span>
            <span className="h-3 w-px bg-[#2A2A2A]" />
            <span className="font-inter text-[10px] text-[#22C55E]">✓ AST</span>
            <span className="h-3 w-px bg-[#2A2A2A]" />
            <span className="font-inter text-[10px] text-[#22C55E]">✓ Semantic</span>
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
        <span className="font-inter text-[10px] text-[#A1A1AA]">Ln {cursor.line}, Col {cursor.column}</span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="font-inter text-[10px] text-[#71717A]">UTF-8</span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="flex items-center gap-1 font-inter text-[9px] text-[#555555]">
          <GitBranch className="h-3 w-3" />main
        </span>
        <span className="h-3 w-px bg-[#2A2A2A]" />
        <span className="flex items-center gap-1.5 font-inter text-[9px] text-[#555555]">
          <span className={`h-1.5 w-1.5 rounded-full ${wasmReady ? "bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.7)]" : "bg-[#F59E0B] animate-pulse"}`} />
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

function TopBar({ activeFile, compilePhase, wasmReady, onManualCompile, onPublish, publishState, activeTool, onToggleAI }: {
  activeFile: string;
  compilePhase: CompilePhase;
  wasmReady: boolean;
  onManualCompile: () => void;
  onPublish: () => void;
  publishState: PublishState;
  activeTool: SidebarTool;
  onToggleAI: () => void;
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
    valid:    "bg-[#8B5CF6]",
    error:    "bg-[#E05252]",
  };
  const phaseTextColor = {
    idle:     wasmReady ? "text-[#666666]" : "text-[#666666]",
    parsing:  "text-[#888888]",
    semantic: "text-[#888888]",
    valid:    "text-[#C4B5FD]",
    error:    "text-[#E05252]",
  };

  return (
    <div className="flex h-14 flex-none items-center justify-between border-b border-white/[0.06] bg-[#151515] px-5">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#8B5CF6]/15 ring-1 ring-[#8B5CF6]/30 shadow-[0_0_18px_rgba(139,92,246,0.12)]">
            <span className="font-inter text-[10px] font-black tracking-tighter text-[#C4B5FD]">FX</span>
          </div>
          <span className="font-inter text-[14px] font-semibold tracking-tight text-white">Formix</span>
        </div>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <div className="flex items-center gap-1 font-inter text-[11px]">
          <span className="text-[#A1A1AA]">my-project</span>
          <ChevronRight className="h-3 w-3 text-[#3A3A3A]" />
          <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[#D4D4D8]">{activeFile}</span>
        </div>
      </div>

      {/* Right: AI Chat + status + run button + publish button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleAI}
          title="Open Formix AI Assistant"
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-inter text-[11px] font-semibold transition-all duration-150 ${
            activeTool === "ai"
              ? "border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#C4B5FD] shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              : "border-white/[0.1] bg-[#1B1B1B] text-[#D4D4D8] hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10 hover:text-white"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#C4B5FD]" />
          AI Assistant
        </button>
        <span className="mx-1 h-5 w-px bg-white/[0.08]" />
        <button type="button" title="Git branch" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 font-inter text-[11px] text-[#A1A1AA] transition-colors hover:bg-white/[0.06] hover:text-white sm:flex">
          <GitFork className="h-3.5 w-3.5" /> main
        </button>
        <button type="button" title="Settings" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white">
          <Settings2 className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/[0.08]" />
        <div className={`flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#1B1B1B] px-3 py-1.5 ${phaseTextColor[compilePhase]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${phaseDot[compilePhase]} shadow-[0_0_8px_currentColor]`} />
          <span className="font-inter text-[10px] font-medium">{phaseLabel[compilePhase]}</span>
        </div>
        <span className="h-4 w-px bg-[#2A2A2A]" />
        <button
          type="button"
          data-action="run"
          onClick={onManualCompile}
          disabled={!wasmReady}
          className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2 font-inter text-[11px] font-semibold text-white shadow-[0_6px_18px_rgba(139,92,246,0.25)] transition-all duration-150 hover:bg-[#7C3AED] hover:shadow-[0_8px_22px_rgba(139,92,246,0.32)] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
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
          className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#1B1B1B] px-4 py-2 font-inter text-[11px] font-semibold text-[#D4D4D8] transition-all duration-150 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10 hover:text-white active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
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
    <PanelResizeHandle className="group relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
      <span className="h-full w-px bg-transparent transition-all duration-150 group-hover:w-0.5 group-hover:bg-[#8B5CF6]/60" />
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
  const [explorerOpen,  setExplorerOpen]  = useState(true);
  const [activeTool,    setActiveTool]    = useState<SidebarTool>("files");

  const editorRef       = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef       = useRef<MonacoLike | null>(null);
  const phaseTimers     = useRef<number[]>([]);
  const explorerPanelRef = useRef<ImperativePanelHandle | null>(null);

  // ── Publish state ──────────────────────────────────────────────────────────
  const [publishState,   setPublishState]   = useState<PublishState>("idle");
  const [publishedUrl,   setPublishedUrl]   = useState<string | null>(null);
  const [publishedEmbed, setPublishedEmbed] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Sync explorer panel collapse with explorerOpen state.
  useEffect(() => {
    if (!explorerPanelRef.current) return;
    if (explorerOpen) {
      explorerPanelRef.current.expand();
    } else {
      explorerPanelRef.current.collapse();
    }
  }, [explorerOpen]);

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
    <div className="ide-shell relative flex h-screen flex-col overflow-hidden bg-[#111111] font-inter text-[#F4F4F5]">
      <TopBar
        activeFile={activeTab || "—"}
        compilePhase={compilePhase}
        wasmReady={wasmReady}
        onManualCompile={handleManualCompile}
        onPublish={handlePublish}
        publishState={publishState}
        activeTool={activeTool}
        onToggleAI={() => {
          setExplorerOpen(true);
          setActiveTool((prev) => (prev === "ai" ? "files" : "ai"));
        }}
      />

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Activity Bar */}
        <aside className="flex w-12 flex-none flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#1B1B1B] py-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <ActivityBtn
            active={activeTool === "files"}
            icon={<Files className="h-4 w-4" />}
            label="Files"
            onClick={() => {
              setExplorerOpen(true);
              setActiveTool("files");
            }}
          />
          <ActivityBtn
            active={activeTool === "ai"}
            icon={<Sparkles className="h-4 w-4 text-[#C4B5FD]" />}
            label="AI Assistant"
            onClick={() => {
              setExplorerOpen(true);
              setActiveTool("ai");
            }}
          />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <PanelGroup direction="horizontal" className="min-h-0 flex-1">
            <Panel ref={explorerPanelRef} defaultSize={22} minSize={16} maxSize={35} collapsible>
              {activeTool === "files" ? (
                <ExplorerPanel
                  files={files}
                  activeFile={activeTab}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onDeleteFile={handleDeleteFile}
                />
              ) : (
                <AIChatPanel
                  currentCode={activeFile?.content ?? ""}
                  onApplyCode={(code) => handleContentChange(activeTab, code)}
                  compile={compile}
                  onClose={() => setActiveTool("files")}
                />
              )}
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
                onToggleExplorer={() => setExplorerOpen((p) => !p)}
                onToggleDiag={() => setDiagOpen((p) => !p)}
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
