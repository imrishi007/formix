"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Files,
  Folder,
  GitBranch,
  Search,
  Settings,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

type SidebarTool = "files" | "git" | "search" | "settings";
type EditorTab = "feedback.forml" | "README.md";
type ParseState = "valid" | "parsing" | "error";

interface TreeEntry {
  name: string;
  kind: "folder" | "file";
  children?: TreeEntry[];
  active?: boolean;
}

interface PreviewField {
  name: string;
  type: string;
  label: string;
  placeholder: string;
  helpText: string;
}

interface CursorState {
  line: number;
  column: number;
}

interface MonacoThemeRule {
  token: string;
  foreground: string;
  fontStyle?: string;
}

interface MonacoTheme {
  base: "vs-dark";
  inherit: boolean;
  rules: MonacoThemeRule[];
  colors: Record<string, string>;
}

interface MonacoLanguageRegistry {
  getLanguages: () => Array<{ id: string }>;
  register: (language: { id: string }) => void;
  setMonarchTokensProvider: (languageId: string, provider: Record<string, unknown>) => void;
}

interface MonacoEditorAPI {
  defineTheme: (name: string, theme: MonacoTheme) => void;
  setTheme: (name: string) => void;
}

interface MonacoLike {
  editor: MonacoEditorAPI;
  languages: MonacoLanguageRegistry;
}

interface FormSummary {
  title: string;
  fields: PreviewField[];
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#080503]">
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FAFAF9]/30">
        Loading editor...
      </span>
    </div>
  ),
});

const INITIAL_DSL = `form "Customer Feedback" {
  field name: text
    ui {
      label: "Your Name"
      placeholder: "Jane Doe"
    }
    validate {
      required
      minLength: 2
    }

  field email: email
    ui {
      label: "Email Address"
      placeholder: "you@company.com"
    }
    validate {
      required
    }

  field rating: select {
    option "Excellent"
    option "Good"
    option "Needs Work"
    option "Poor"
  }
  ui {
    label: "Overall Rating"
  }

  field comments: text
    ui {
      label: "Additional Comments"
      helpText: "Tell us more about your experience."
      placeholder: "Your feedback here..."
    }

  action submit {
    endpoint: "https://api.formix.dev/submit"
    method: POST
  }
}`;

const README_CONTENT = `# Formix

Forms as Code.

- One \`.forml\` file = one form
- Client-side WASM parser
- Monaco editor
- Live preview`;

const FILE_TREE: TreeEntry[] = [
  {
    name: ".github",
    kind: "folder",
    children: [{ name: "workflows", kind: "folder" }],
  },
  {
    name: "src",
    kind: "folder",
    children: [
      { name: "app", kind: "folder" },
      { name: "components", kind: "folder" },
      { name: "wasm", kind: "folder" },
    ],
  },
  {
    name: "feedback.forml",
    kind: "file",
    active: true,
  },
  {
    name: "README.md",
    kind: "file",
  },
];

const SIDEBAR_TOOLS: Array<{ id: SidebarTool; icon: ReactNode; label: string }> = [
  { id: "files", icon: <Files className="h-4 w-4" />, label: "Files" },
  { id: "git", icon: <GitBranch className="h-4 w-4" />, label: "Git" },
  { id: "search", icon: <Search className="h-4 w-4" />, label: "Search" },
  { id: "settings", icon: <Settings className="h-4 w-4" />, label: "Settings" },
];

const MONACO_OPTIONS = {
  automaticLayout: true,
  contextmenu: false,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: false,
  fontSize: 13,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 10,
  lineHeight: 22,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 3,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  quickSuggestions: false,
  renderLineHighlight: "none" as const,
  renderValidationDecorations: "off" as const,
  renderWhitespace: "none" as const,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    horizontalScrollbarSize: 4,
    verticalScrollbarSize: 4,
  },
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
};

function defineFormixNightTheme(monaco: MonacoLike) {
  const languageId = "forml";
  const hasLanguage = monaco.languages.getLanguages().some((language) => language.id === languageId);

  if (!hasLanguage) {
    monaco.languages.register({ id: languageId });
  }

  monaco.languages.setMonarchTokensProvider(languageId, {
    tokenizer: {
      root: [
        [/\b(?:form|field|ui|validate|action|submit|option|required|minLength|POST|PUT|PATCH|text|email|select|radio|checkbox)\b/, "keyword"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/\d+(?:\.\d+)?/, "number"],
        [/[{}()[\]:;,=]/, "delimiter"],
        [/==|!=|<=|>=|&&|\|\||[<>+\-*/]/, "operator"],
        [/[a-zA-Z_]\w*/, "identifier"],
        [/--.*$/, "comment"],
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string"],
        [/"/, "string", "@pop"],
      ],
    },
  });

  monaco.editor.defineTheme("formix-night", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "FAFAF9" },
      { token: "keyword", foreground: "FAFAF9" },
      { token: "string", foreground: "FAFAF9" },
      { token: "number", foreground: "FAFAF9" },
      { token: "delimiter", foreground: "FAFAF9" },
      { token: "operator", foreground: "FAFAF9" },
      { token: "identifier", foreground: "FAFAF9" },
      { token: "comment", foreground: "FAFAF9" },
    ],
    colors: {
      "editor.background": "#080503",
      "editor.foreground": "#FAFAF9",
      "editorLineNumber.foreground": "#FAFAF966",
      "editorLineNumber.activeForeground": "#FAFAF9",
      "editorGutter.background": "#080503",
      "editorCursor.foreground": "#FAFAF9",
      "editor.selectionBackground": "#FAFAF91A",
      "editor.inactiveSelectionBackground": "#FAFAF90E",
      "editor.lineHighlightBackground": "#FAFAF90A",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#FAFAF914",
      "editorIndentGuide.activeBackground1": "#FAFAF92A",
      "editorWhitespace.foreground": "#FAFAF914",
      "editorWidget.background": "#080503",
      "editorWidget.border": "#FAFAF91A",
      "editorWidget.foreground": "#FAFAF9",
      "editorSuggestWidget.background": "#080503",
      "editorSuggestWidget.border": "#FAFAF91A",
      "editorSuggestWidget.foreground": "#FAFAF9",
      "editorSuggestWidget.selectedBackground": "#FAFAF91A",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#FAFAF90A",
      "scrollbarSlider.hoverBackground": "#FAFAF91A",
      "scrollbarSlider.activeBackground": "#FAFAF929",
      "editorOverviewRuler.border": "#00000000",
      "focusBorder": "#FAFAF91F",
    },
  });
}

function parseFormSummary(source: string): FormSummary {
  const titleMatch = source.match(/form\s+"([^"]+)"/);
  const title = titleMatch?.[1] ?? "Untitled Form";
  const fieldMatches = [...source.matchAll(/field\s+([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)/g)];

  const fields = fieldMatches.map((match, index) => {
    const start = match.index ?? 0;
    const end = fieldMatches[index + 1]?.index ?? source.length;
    const snippet = source.slice(start, end);
    const label = snippet.match(/label:\s*"([^"]+)"/)?.[1] ?? match[1];
    const placeholder = snippet.match(/placeholder:\s*"([^"]+)"/)?.[1] ?? "";
    const helpText = snippet.match(/helpText:\s*"([^"]+)"/)?.[1] ?? "";

    return {
      name: match[1],
      type: match[2],
      label,
      placeholder,
      helpText,
    };
  });

  return { title, fields };
}

function getParseState(source: string): ParseState {
  const trimmed = source.trim();
  if (!trimmed.startsWith("form")) {
    return "error";
  }

  const opens = (source.match(/\{/g) || []).length;
  const closes = (source.match(/\}/g) || []).length;
  return opens === closes ? "valid" : "error";
}

function ActivityButton({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      className={`flex h-10 w-10 items-center justify-center border-r border-foreground/10 transition-colors ${
        active ? "bg-foreground text-background" : "text-foreground/50 hover:bg-foreground/[0.03] hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );
}

function TreeRow({ entry, depth = 0 }: { entry: TreeEntry; depth?: number }) {
  const isFolder = entry.kind === "folder";

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 text-[11px] font-mono ${
          entry.active ? "text-foreground" : "text-foreground/50"
        }`}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {isFolder ? (
          <ChevronRight className="h-3 w-3 text-foreground/25" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full border border-foreground/20" />
        )}
        {isFolder ? <Folder className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        <span className={entry.active ? "text-foreground" : ""}>{entry.name}</span>
        {entry.active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" /> : null}
      </div>
      {entry.children?.map((child) => (
        <TreeRow key={`${entry.name}-${child.name}`} entry={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function ExplorerPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAF9]">
      <div className="flex h-9 items-center justify-between border-b border-foreground/10 px-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/35">
          Formix / Explorer
        </span>
      </div>

      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/35">
          Project Files
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/25">
          feedback.forml
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4">
        <div className="space-y-0.5">
          {FILE_TREE.map((entry) => (
            <TreeRow key={entry.name} entry={entry} />
          ))}
        </div>
      </div>

      <div className="border-t border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/35">
          <CircleDot className="h-3 w-3" />
          Workspace synced
        </div>
      </div>
    </div>
  );
}

function EditorTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
}) {
  return (
    <div className="flex h-10 items-end border-b border-[#FAFAF9]/10 bg-[#080503] px-3">
      {(["feedback.forml", "README.md"] as const).map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`relative flex h-9 items-center gap-2 border-r border-[#FAFAF9]/8 px-4 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors ${
              active ? "bg-[#FAFAF9]/5 text-[#FAFAF9]" : "text-[#FAFAF9]/45 hover:text-[#FAFAF9]/80"
            }`}
          >
            <span>{tab}</span>
            {active ? <span className="absolute inset-x-0 bottom-0 h-px bg-[#FAFAF9]" /> : null}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2 pb-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#FAFAF9]/30">
          JetBrains Mono
        </span>
      </div>
    </div>
  );
}

function EditorPanel({
  activeTab,
  dsl,
  readme,
  onTabChange,
  onDslChange,
  onCursorChange,
}: {
  activeTab: EditorTab;
  dsl: string;
  readme: string;
  onTabChange: (tab: EditorTab) => void;
  onDslChange: (value: string) => void;
  onCursorChange: (cursor: CursorState) => void;
}) {
  const editorValue = activeTab === "feedback.forml" ? dsl : readme;
  const editorLanguage = activeTab === "feedback.forml" ? "forml" : "markdown";
  const readOnly = activeTab === "README.md";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080503] text-[#FAFAF9]">
      <EditorTabs activeTab={activeTab} onTabChange={onTabChange} />
      <div className="relative min-h-0 flex-1 bg-[#080503]">
        <MonacoEditor
          beforeMount={defineFormixNightTheme}
          theme="formix-night"
          language={editorLanguage}
          value={editorValue}
          onChange={(value) => {
            if (activeTab === "feedback.forml") {
              onDslChange(value ?? "");
            }
          }}
          onMount={(editor, monaco) => {
            monaco.editor.setTheme("formix-night");
            editor.updateOptions(MONACO_OPTIONS);
            editor.onDidChangeCursorPosition((event) => {
              onCursorChange({
                line: event.position.lineNumber,
                column: event.position.column,
              });
            });
          }}
          options={{
            ...MONACO_OPTIONS,
            readOnly,
            domReadOnly: readOnly,
          }}
        />
      </div>
    </div>
  );
}

function PreviewPanel({
  summary,
  parseState,
}: {
  summary: FormSummary;
  parseState: ParseState;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAF9]">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/35">
          Live Preview
        </span>
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.24em] ${
            parseState === "valid" ? "text-foreground" : "text-foreground/45"
          }`}
        >
          {parseState === "valid" ? "Render ready" : "Parse pending"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {parseState === "error" ? (
          <div className="border border-foreground/10 p-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/35">
              Parse Error
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-foreground/70">
              The current DSL needs matching braces and a `form` declaration before the preview can render.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[380px] flex-col border border-foreground/10 bg-[#FAFAF9] p-6">
            <div className="border-b border-foreground/10 pb-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/35">
                Form Preview
              </p>
              <h2 className="mt-3 font-display text-[2rem] leading-none text-foreground">
                {summary.title}
              </h2>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/25">
                {summary.fields.length} fields loaded
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {summary.fields.map((field) => (
                <div key={field.name}>
                  <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/45">
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <div className="border-b border-foreground/15 pb-2 font-sans text-sm text-foreground/75">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                        Select an option
                      </span>
                    </div>
                  ) : field.type === "text" || field.type === "email" ? (
                    <div className="border-b border-foreground/15 pb-2 font-sans text-sm text-foreground/45">
                      {field.placeholder || "Type here..."}
                    </div>
                  ) : (
                    <div className="border-b border-foreground/15 pb-2 font-sans text-sm text-foreground/45">
                      Field type: {field.type}
                    </div>
                  )}
                  {field.helpText ? (
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/25">
                      {field.helpText}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-8 h-11 border border-foreground bg-foreground font-mono text-[10px] uppercase tracking-[0.28em] text-[#FAFAF9]"
            >
              Submit Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PartitionHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center bg-transparent">
      <span className="h-full w-px bg-foreground/10 transition-colors group-hover:bg-foreground/35" />
    </PanelResizeHandle>
  );
}

export function DemoIdeShell() {
  const [activeTool, setActiveTool] = useState<SidebarTool>("files");
  const [activeTab, setActiveTab] = useState<EditorTab>("feedback.forml");
  const [dsl, setDsl] = useState(INITIAL_DSL);
  const [cursor, setCursor] = useState<CursorState>({ line: 1, column: 1 });
  const [parseState, setParseState] = useState<ParseState>("parsing");
  const summary = useMemo(() => parseFormSummary(dsl), [dsl]);
  const readme = useMemo(() => README_CONTENT, []);
  const parseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (parseTimerRef.current !== null) {
      window.clearTimeout(parseTimerRef.current);
    }

    setParseState("parsing");
    parseTimerRef.current = window.setTimeout(() => {
      setParseState(getParseState(dsl));
    }, 180);

    return () => {
      if (parseTimerRef.current !== null) {
        window.clearTimeout(parseTimerRef.current);
      }
    };
  }, [dsl]);

  return (
    <div className="relative h-screen overflow-hidden bg-[#FAFAF9] text-[#080503]">
      <aside className="absolute left-0 top-0 bottom-7 z-20 flex w-14 flex-col border-r border-foreground/10 bg-[#FAFAF9]">
        <div className="flex h-14 items-center justify-center border-b border-foreground/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.34em] text-foreground/35">
            FX
          </span>
        </div>
        <nav className="flex flex-1 flex-col">
          {SIDEBAR_TOOLS.map((tool) => (
            <ActivityButton
              key={tool.id}
              active={activeTool === tool.id}
              icon={tool.icon}
              label={tool.label}
            />
          ))}
        </nav>
        <div className="border-t border-foreground/10 p-3">
          <button
            type="button"
            onClick={() => setActiveTool("settings")}
            className="flex h-8 w-8 items-center justify-center text-foreground/40 transition-colors hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="h-full pl-14 pb-7">
        <PanelGroup direction="horizontal" className="h-full min-h-0 w-full">
          <Panel defaultSize={24} minSize={18} className="min-h-0 bg-[#FAFAF9]">
            <ExplorerPanel />
          </Panel>
          <PartitionHandle />
          <Panel defaultSize={46} minSize={30} className="min-h-0 bg-[#080503]">
            <EditorPanel
              activeTab={activeTab}
              dsl={dsl}
              readme={readme}
              onTabChange={setActiveTab}
              onDslChange={setDsl}
              onCursorChange={setCursor}
            />
          </Panel>
          <PartitionHandle />
          <Panel defaultSize={30} minSize={20} className="min-h-0 bg-[#FAFAF9]">
            <PreviewPanel summary={summary} parseState={parseState} />
          </Panel>
        </PanelGroup>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 z-30 flex h-7 items-center justify-between border-t border-foreground/10 bg-[#FAFAF9] px-4">
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/55">
          <span>PARSE STATUS: {parseState === "valid" ? "VALID" : parseState === "parsing" ? "PARSING" : "ERROR"}</span>
          <span className="text-foreground/20">|</span>
          <span>
            Line {cursor.line} / Col {cursor.column}
          </span>
          <span className="text-foreground/20">|</span>
          <span>UTF-8</span>
          <span className="text-foreground/20">|</span>
          <span>Branch: main</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/35">
          <span>feedback.forml</span>
          <span className="text-foreground/20">|</span>
          <span>{activeTab}</span>
        </div>
      </footer>
    </div>
  );
}
