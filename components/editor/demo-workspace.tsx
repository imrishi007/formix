"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

type ParseStatus = "idle" | "ok" | "error" | "parsing";
type WorkspacePanel = "editor" | "preview" | "chat";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const renderMessageContent = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const lines = part.slice(3, -3).trim().split("\n");
      const hasLang = lines.length > 0 && /^[a-zA-Z0-9_-]+$/.test(lines[0]);
      const codeLines = hasLang ? lines.slice(1) : lines;
      return (
        <pre
          key={index}
          className="w-full my-2 p-3 bg-[#FAFAF9] border border-foreground/10 font-mono text-xs text-[#080503] overflow-x-auto whitespace-pre rounded-none"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
    }

    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <span key={index}>
        {inlineParts.map((subPart, subIndex) => {
          if (subPart.startsWith("`") && subPart.endsWith("`")) {
            return (
              <code
                key={subIndex}
                className="font-mono bg-foreground/5 px-1 py-0.5 text-xs text-foreground border border-foreground/5 rounded-none"
              >
                {subPart.slice(1, -1)}
              </code>
            );
          }
          return subPart;
        })}
      </span>
    );
  });
};

interface MonacoThemeRule {
  token: string;
  foreground: string;
  fontStyle?: string;
}

interface MonacoTheme {
  base: "vs";
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

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-background">
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/25">
        Loading editor...
      </span>
    </div>
  ),
});

const INITIAL_DSL = `form "Customer Feedback" {

  field name : text
    ui {
      label: "Your Name"
      placeholder: "Jane Doe"
    }
    validate { required  minLength: 2 }

  field email : email
    ui {
      label: "Email Address"
      placeholder: "you@company.com"
    }
    validate { required }

  field rating : select {
    option "Excellent"
    option "Good"
    option "Needs Work"
    option "Poor"
  }
  ui { label: "Overall Rating" }

  field comments : text
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

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Welcome to Formix. Describe the form you need in plain English - I'll generate valid Forml DSL and apply it to the editor.\n\nThe C++ parser (via WASM) will validate it in real-time.",
  },
];

const FORM_KEYWORDS = [
  "form",
  "field",
  "section",
  "group",
  "use",
  "var",
  "page",
  "repeat",
  "count",
  "if",
  "else",
  "on",
  "compute",
  "validate",
  "action",
  "submit",
  "from",
  "url",
  "map",
  "row",
  "column",
  "true",
  "false",
  "POST",
  "PUT",
  "PATCH",
  "load",
  "change",
  "blur",
  "hide",
  "show",
  "clear",
  "set",
  "navigate",
  "text",
  "integer",
  "float",
  "email",
  "date",
  "boolean",
  "select",
  "radio",
  "checkbox",
  "required",
  "min",
  "max",
  "minLength",
  "maxLength",
  "pattern",
  "label",
  "placeholder",
  "helpText",
  "default",
  "bind",
  "endpoint",
  "method",
  "option",
];

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  folding: false,
  glyphMargin: false,
  lineNumbers: "on" as const,
  lineDecorationsWidth: 2,
  lineNumbersMinChars: 3,
  renderLineHighlight: "none" as const,
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: "off" as const,
  fontSize: 13,
  lineHeight: 22,
  fontFamily: "'JetBrains Mono', monospace",
  fontLigatures: false,
  padding: { top: 20, bottom: 60 },
  smoothScrolling: true,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
  hideCursorInOverviewRuler: true,
  renderWhitespace: "none" as const,
  bracketPairColorization: { enabled: false },
  guides: { indentation: false, bracketPairs: false },
  scrollbar: {
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    alwaysConsumeMouseWheel: false,
    vertical: "auto" as const,
    horizontal: "auto" as const,
  },
  contextmenu: false,
  quickSuggestions: false,
  suggest: { showWords: false },
  parameterHints: { enabled: false },
  hover: { enabled: false },
  links: false,
  colorDecorators: false,
  renderValidationDecorations: "off" as const,
  codeLens: false,
  matchBrackets: "near" as const,
  occurrencesHighlight: "off" as const,
  selectionHighlight: false,
  scrollbarBehavior: "smooth",
};

const INPUT_LINE =
  "w-full bg-transparent border-0 border-b border-foreground/15 rounded-none " +
  "px-0 py-2 font-sans text-[15px] text-foreground leading-snug " +
  "placeholder:text-foreground/20 outline-none ring-0 " +
  "focus:border-foreground/50 focus:ring-0 transition-colors duration-150";

const SELECT_LINE =
  "w-full bg-transparent border-0 border-b border-foreground/15 rounded-none " +
  "px-0 py-2 font-sans text-[15px] text-foreground appearance-none " +
  "outline-none focus:border-foreground/50 transition-colors duration-150 cursor-pointer";

function defineFormixPaperTheme(monaco: MonacoLike) {
  const languageId = "forml";
  const hasLanguage = monaco.languages.getLanguages().some((language) => language.id === languageId);

  if (!hasLanguage) {
    monaco.languages.register({ id: languageId });
  }

  monaco.languages.setMonarchTokensProvider(languageId, {
    tokenizer: {
      root: [
        [new RegExp(`\\b(?:${FORM_KEYWORDS.join("|")})\\b`), "keyword"],
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

  monaco.editor.defineTheme("formix-paper", {
    base: "vs",
    inherit: false,
    rules: [
      { token: "", foreground: "080503" },
      { token: "keyword", foreground: "080503" },
      { token: "string", foreground: "080503" },
      { token: "number", foreground: "080503" },
      { token: "delimiter", foreground: "080503" },
      { token: "operator", foreground: "080503" },
      { token: "identifier", foreground: "080503" },
      { token: "comment", foreground: "080503" },
    ],
    colors: {
      "editor.background": "#FAFAF9",
      "editor.foreground": "#080503",
      "editorLineNumber.foreground": "#08050366",
      "editorLineNumber.activeForeground": "#080503",
      "editorGutter.background": "#FAFAF9",
      "editorCursor.foreground": "#080503",
      "editorCursor.background": "#FAFAF9",
      "editor.selectionBackground": "#08050314",
      "editor.inactiveSelectionBackground": "#0805030a",
      "editor.lineHighlightBackground": "#08050308",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#08050310",
      "editorIndentGuide.activeBackground1": "#08050322",
      "editorWhitespace.foreground": "#08050312",
      "editorWidget.background": "#FAFAF9",
      "editorWidget.border": "#DAD7D0",
      "editorWidget.foreground": "#080503",
      "editorSuggestWidget.background": "#FAFAF9",
      "editorSuggestWidget.border": "#DAD7D0",
      "editorSuggestWidget.foreground": "#080503",
      "editorSuggestWidget.selectedBackground": "#08050310",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#0805030a",
      "scrollbarSlider.hoverBackground": "#08050314",
      "scrollbarSlider.activeBackground": "#08050322",
      "editorOverviewRuler.border": "#00000000",
      "focusBorder": "#08050322",
    },
  });
}



export function DemoWorkspace() {
  const [mounted, setMounted] = useState(false);
  const [dsl, setDsl] = useState(INITIAL_DSL);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("ok");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [isSending, setIsSending] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showChat, setShowChat] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setParseStatus("parsing");
    const timer = window.setTimeout(() => {
      const opens = (dsl.match(/\{/g) || []).length;
      const closes = (dsl.match(/\}/g) || []).length;
      setParseStatus(opens === closes && dsl.trim().startsWith("form") ? "ok" : "error");
    }, 350);

    return () => window.clearTimeout(timer);
  }, [dsl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", content }]);
    setDraft("");

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Got it. The AI orchestrator will wrap your prompt in the full EBNF grammar context and call the LLM. The C++ parser self-corrects up to 3 times before surfacing an error. Stub - FastAPI backend connection coming next.",
        },
      ]);
      setIsSending(false);
    }, 1100);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const visiblePanels: WorkspacePanel[] = [
    showEditor ? "editor" : null,
    showPreview ? "preview" : null,
    showChat ? "chat" : null,
  ].filter((panel): panel is WorkspacePanel => panel !== null);

  const visibleCount = visiblePanels.length;
  let editorSize = 0;
  let previewSize = 0;
  let chatSize = 0;

  if (visibleCount === 3) {
    editorSize = 33;
    previewSize = 33;
    chatSize = 34;
  } else if (visibleCount === 2) {
    if (showEditor) {
      editorSize = 50;
      if (showPreview) previewSize = 50;
      else chatSize = 50;
    } else {
      previewSize = 50;
      chatSize = 50;
    }
  } else if (visibleCount === 1) {
    if (showEditor) editorSize = 100;
    else if (showPreview) previewSize = 100;
    else chatSize = 100;
  }

  const panelToggle = (label: string, active: boolean, toggle: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={toggle}
      className={`px-2.5 py-1 border border-foreground/10 font-mono text-xs uppercase tracking-[0.18em] transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-background text-foreground/45 hover:text-foreground hover:bg-foreground/[0.03]"
      }`}
    >
      [ {label} ]
    </button>
  );

  if (!mounted) {
    return (
      <div className="flex flex-col h-screen bg-[#FAFAF9] text-[#080503] overflow-hidden font-mono">
        <header className="flex items-center justify-between h-12 border-b border-foreground/10 px-5 shrink-0 bg-[#FAFAF9]">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#080503]/40">
              Initializing Workspace...
            </span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center bg-[#FAFAF9]">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#080503]/50 animate-pulse">
            Loading Formix IDE...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="flex items-center justify-between h-12 border-b border-foreground/10 px-5 shrink-0 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-3 h-3" />
            Home
          </Link>
          <span className="w-px h-3.5 bg-foreground/10 shrink-0" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/35 truncate">
            feedback.forml
          </span>
          <span className="w-px h-3.5 bg-foreground/10 shrink-0" />
          <div className="inline-flex items-center gap-1">
            {panelToggle("Code", showEditor, () => setShowEditor((value) => !value))}
            {panelToggle("Preview", showPreview, () => setShowPreview((value) => !value))}
            {panelToggle("AI", showChat, () => setShowChat((value) => !value))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDsl(INITIAL_DSL);
              setMessages(INITIAL_MESSAGES);
            }}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <span className="w-px h-3.5 bg-foreground/10" />
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-widest border border-foreground bg-foreground text-background hover:bg-foreground/88 px-3.5 h-7 transition-colors"
          >
            Publish
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 border-b border-foreground/10 bg-background">
        {visibleCount === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md border border-foreground/10 p-8 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/30 mb-3">
                Workspace hidden
              </p>
              <p className="font-display text-2xl text-foreground">
                Turn on a panel to continue.
              </p>
              <p className="mt-3 font-mono text-xs text-foreground/40 leading-relaxed">
                Use the Code, Preview, and AI toggles in the toolbar to restore the IDE layout.
              </p>
            </div>
          </div>
        ) : (
          <PanelGroup key={visiblePanels.join(",")} direction="horizontal" className="h-full w-full min-h-0">
            {showEditor && (
              <Panel defaultSize={editorSize} minSize={20} className="min-h-0 bg-background">
                <section className="flex h-full min-h-0 flex-col border-r border-foreground/10 bg-background">
                  <div className="flex items-center justify-between shrink-0 h-9 border-b border-foreground/10 px-4 bg-background">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="ml-2 w-px h-3 bg-foreground/10" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/35 truncate">
                        feedback.forml
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {parseStatus === "parsing" && (
                        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/30">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Parsing
                        </span>
                      )}
                      {parseStatus === "ok" && (
                        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Valid
                        </span>
                      )}
                      {parseStatus === "error" && (
                        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 bg-background">
                    <MonacoEditor
                      beforeMount={defineFormixPaperTheme}
                      theme="formix-paper"
                      language="forml"
                      value={dsl}
                      onChange={(value) => setDsl(value ?? "")}
                      onMount={(editor, monaco) => {
                        monaco.editor.setTheme("formix-paper");
                        editor.updateOptions(EDITOR_OPTIONS);
                        editor.onDidChangeCursorPosition((event) => {
                          setCursor({
                            line: event.position.lineNumber,
                            col: event.position.column,
                          });
                        });
                      }}
                      options={EDITOR_OPTIONS}
                    />
                  </div>
                </section>
              </Panel>
            )}
            {showEditor && (showPreview || showChat) && (
              <PanelResizeHandle
                className="group relative flex w-2 shrink-0 items-stretch justify-center bg-transparent transition-colors cursor-col-resize focus-visible:outline-none"
                aria-label="Resize panel"
              >
                <span className="h-full w-px bg-foreground/10 transition-all duration-150 group-hover:bg-foreground/35 group-hover:w-[2px]" />
              </PanelResizeHandle>
            )}

            {showPreview && (
              <Panel defaultSize={previewSize} minSize={20} className="min-h-0 bg-background">
                <section className="flex h-full min-h-0 flex-col bg-background border-r border-foreground/10">
                  <div className="flex items-center justify-between shrink-0 h-9 border-b border-foreground/10 px-4">
                    <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/35">
                      Live Preview
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em]">
                      <span className="text-foreground/25">AST -&gt; Render</span>
                      <span className="w-px h-3 bg-foreground/10" />
                      <span
                        className={
                          parseStatus === "ok"
                            ? "text-foreground"
                            : parseStatus === "error"
                              ? "text-foreground"
                              : "text-foreground/25"
                        }
                      >
                        {parseStatus === "ok"
                          ? "Ready"
                          : parseStatus === "error"
                            ? "Error"
                            : "Idle"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto">
                    {parseStatus === "error" ? (
                      <div className="h-full flex items-center justify-center px-10">
                        <div className="w-full max-w-xs">
                          <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-foreground/40 mb-3">
                            Parse Error
                          </p>
                          <p className="font-mono text-xs text-foreground/55 leading-relaxed">
                            Brace mismatch or missing <span className="text-foreground">form</span> keyword. Fix the DSL to render a live preview.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-[360px] mx-auto px-6 py-10">
                        <div className="mb-10 pb-6 border-b border-foreground/10">
                          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/30 mb-3">
                            form preview
                          </p>
                          <h2 className="font-display text-[2rem] leading-[1] text-foreground">
                            Customer Feedback
                          </h2>
                          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/25">
                            feedback.forml - 4 fields
                          </p>
                        </div>

                        <div className="mb-7">
                          <label className="block font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/40 mb-3">
                            Your Name <span className="text-foreground">*</span>
                          </label>
                          <input type="text" placeholder="Jane Doe" className={INPUT_LINE} />
                        </div>

                        <div className="mb-7">
                          <label className="block font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/40 mb-3">
                            Email Address <span className="text-foreground">*</span>
                          </label>
                          <input type="email" placeholder="you@company.com" className={INPUT_LINE} />
                        </div>

                        <div className="mb-7">
                          <label className="block font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/40 mb-3">
                            Overall Rating
                          </label>
                          <div className="relative">
                            <select className={SELECT_LINE}>
                              <option value="">Select an option</option>
                              <option>Excellent</option>
                              <option>Good</option>
                              <option>Needs Work</option>
                              <option>Poor</option>
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25 pointer-events-none" />
                          </div>
                        </div>

                        <div className="mb-10">
                          <label className="block font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/40 mb-3">
                            Additional Comments
                          </label>
                          <textarea
                            placeholder="Your feedback here..."
                            rows={3}
                            className={INPUT_LINE + " resize-none border-b py-2 h-auto block"}
                          />
                          <p className="mt-2 font-mono text-[9px] text-foreground/25 uppercase tracking-[0.18em]">
                            Tell us more about your experience.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="w-full h-11 bg-foreground text-background font-mono text-[10px] uppercase tracking-[0.28em] hover:bg-foreground/90 transition-colors"
                        >
                          Submit Form
                        </button>

                        <div className="mt-7 pt-5 border-t border-foreground/10 flex items-center justify-between">
                          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/20">
                            POST
                          </span>
                          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/20">
                            api.formix.dev/submit
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </Panel>
            )}
            {showPreview && showChat && (
              <PanelResizeHandle
                className="group relative flex w-2 shrink-0 items-stretch justify-center bg-transparent transition-colors cursor-col-resize focus-visible:outline-none"
                aria-label="Resize panel"
              >
                <span className="h-full w-px bg-foreground/10 transition-all duration-150 group-hover:bg-foreground/35 group-hover:w-[2px]" />
              </PanelResizeHandle>
            )}

            {showChat && (
              <Panel defaultSize={chatSize} minSize={20} className="min-h-0 bg-background">
                <section className="flex h-full min-h-0 flex-col bg-background">
                  <div className="flex items-center justify-between shrink-0 h-9 border-b border-foreground/10 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 ast-status-pulse" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-foreground/35">
                        AI Assistant
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMessages(INITIAL_MESSAGES)}
                      className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/25 hover:text-foreground/55 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`flex flex-col gap-1.5 ${
                          message.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-foreground/25 px-0.5">
                          {message.role === "user" ? "You" : "Formix AI"}
                        </span>

                        {message.role === "user" ? (
                          <div className="max-w-[85%] px-3.5 py-2.5 font-sans text-sm leading-relaxed text-foreground border border-foreground/15 bg-foreground/[0.03]">
                            {renderMessageContent(message.content)}
                          </div>
                        ) : (
                          <div className="max-w-[85%] px-3.5 py-2.5 font-sans text-sm leading-relaxed text-foreground bg-foreground/[0.04] whitespace-pre-wrap">
                            {renderMessageContent(message.content)}
                          </div>
                        )}
                      </div>
                    ))}

                    {isSending && (
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-foreground/25 px-0.5">
                          Formix AI
                        </span>
                        <div className="px-3.5 py-3 bg-foreground/[0.04]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 bg-foreground/30 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-1 h-1 bg-foreground/30 rounded-full animate-bounce [animation-delay:120ms]" />
                            <span className="w-1 h-1 bg-foreground/30 rounded-full animate-bounce [animation-delay:240ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="shrink-0 border-t border-foreground/10">
                    <div className="flex items-center gap-0">
                      <input
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe the form in plain English..."
                        className="flex-1 min-w-0 h-12 bg-background px-4 font-sans text-sm text-foreground placeholder:text-foreground/20 outline-none border-0 ring-0"
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!draft.trim() || isSending}
                        className="shrink-0 w-12 h-12 flex items-center justify-center text-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors border-l border-foreground/10"
                        aria-label="Send message"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="px-4 pb-2.5 font-mono text-[8px] uppercase tracking-[0.22em] text-foreground/20">
                      Enter to send - powered by Formix AI
                    </p>
                  </div>
                </section>
              </Panel>
            )}
          </PanelGroup>
        )}
      </div>

      <footer className="flex items-center justify-between h-7 border-t border-foreground/10 px-5 shrink-0 bg-background">
        <div className="flex items-center gap-4">
          <span
            className={`font-mono text-[8.5px] uppercase tracking-[0.2em] flex items-center gap-1.5 ${
              parseStatus === "ok"
                ? "text-foreground"
                : parseStatus === "error"
                  ? "text-foreground"
                  : "text-foreground/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                parseStatus === "ok"
                  ? "bg-foreground ast-status-pulse"
                  : parseStatus === "error"
                    ? "bg-foreground ast-status-blink"
                    : "bg-foreground/20"
              }`}
            />
            {parseStatus === "ok"
              ? "Parse OK"
              : parseStatus === "error"
                ? "Parse Error"
                : "Parsing..."}
          </span>
          <span className="w-px h-3 bg-foreground/8" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/20">
            Forml v1.1
          </span>
          <span className="w-px h-3 bg-foreground/8" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/20">
            WASM - Client-side
          </span>
          <span className="w-px h-3 bg-foreground/8" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/20">
            JetBrains Mono
          </span>
        </div>

        <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/25">
          Ln {cursor.line} - Col {cursor.col}
        </span>
      </footer>
    </div>
  );
}
