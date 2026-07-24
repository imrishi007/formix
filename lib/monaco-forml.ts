// lib/monaco-forml.ts
//
// Shared Monaco configuration for the "forml" language: theme, Monarch
// tokenizer, editor options, and the minimal Monaco typings we need without
// pulling in the (very heavy) monaco type package at runtime.
//
// Used by:
<<<<<<< HEAD
//   - components/editor/demo-ide-shell.tsx     (the author IDE)
=======
//   - components/workspace/editor-pane.tsx      (the author workspace)
>>>>>>> f6620dd (Complete Formix updates)
//   - components/editor/compiler-playground.tsx (the compiler playground)
//   - lib/monaco-forml-language.ts             (the FormL language service)
//
// Keeping this in one place means both editors always agree on what "forml"
// looks like, and we never register the same language twice (Monaco throws
// if you do).

import type { editor as MonacoEditorNS } from "monaco-editor";

// ── Minimal Monaco typings ───────────────────────────────────────────────────
// We avoid importing the full monaco-editor type surface here so this module
// stays cheap to import on the client. The shapes below are exactly what the
// theme + tokenizer + language registration APIs need.

export interface MonacoThemeRule {
  token: string;
  foreground: string;
  fontStyle?: string;
}

export interface MonacoTheme {
  base: "vs-dark";
  inherit: boolean;
  rules: MonacoThemeRule[];
  colors: Record<string, string>;
}

export interface MonacoLanguageRegistry {
  getLanguages: () => Array<{ id: string }>;
  register: (language: { id: string }) => void;
  setMonarchTokensProvider: (id: string, p: Record<string, unknown>) => void;
  setLanguageConfiguration: (
    id: string,
    config: Record<string, unknown>,
  ) => void;
}

export interface MonacoCompletionContext {
  triggerKind: number;
  triggerCharacter: string;
}

export interface MonacoEditorAPI {
  defineTheme: (name: string, theme: MonacoTheme) => void;
  setTheme: (name: string) => void;
  setModelMarkers: (
    model: MonacoEditorNS.ITextModel,
    owner: string,
    markers: MonacoEditorNS.IMarkerData[],
  ) => void;
}

export interface MonacoLike {
  editor: MonacoEditorAPI;
  languages: MonacoLanguageRegistry;
  MarkerSeverity: { Error: number; Warning: number; Info: number };
}

// ── The list of all FormL keywords ───────────────────────────────────────────
// Single source of truth — consumed by the Monarch tokenizer, the language
// service's completion provider, and the hover docs.

export const FORML_KEYWORDS = [
  // Top-level structure
  "form", "field", "page", "section", "group", "use", "var",
  "repeat", "count", "if", "else", "on",
  // Field types
  "text", "integer", "float", "email", "date", "boolean", "url",
<<<<<<< HEAD
  "select", "radio", "checkbox",
=======
  "select", "radio", "checkbox", "upload",
  "file", "image", "pdf", "document", // deprecated, kept for old source
>>>>>>> f6620dd (Complete Formix updates)
  // Blocks
  "ui", "validate", "action", "submit", "option",
  "compute", "from", "map", "row", "column",
  // Validation rules
  "required", "minLength", "maxLength", "pattern", "min", "max",
<<<<<<< HEAD
=======
  // Upload-block rules (also legacy validate-block rules for file/image/pdf/document)
  "accept", "maxSize", "multiple", "minFiles", "maxFiles",
>>>>>>> f6620dd (Complete Formix updates)
  // Trigger events
  "load", "change", "blur",
  // Trigger actions
  "hide", "show", "clear", "set", "navigate",
  // UI keys
  "label", "placeholder", "helpText", "endpoint", "method",
  "default", "bind",
] as const;

export const FORML_FIELD_TYPES = [
  "text", "integer", "float", "email", "date", "boolean", "url",
<<<<<<< HEAD
  "select", "radio", "checkbox",
=======
  "select", "radio", "checkbox", "upload",
>>>>>>> f6620dd (Complete Formix updates)
] as const;

export const FORML_HTTP_METHODS = ["POST", "PUT", "PATCH"] as const;

// ── Editor options ───────────────────────────────────────────────────────────
// Tuned for a FormL authoring experience: readable typography, a calm
// VS Code-like canvas, and enough visual structure for long-form authoring.
// The language service
// (autocomplete/hover) is enabled by default.

export const MONACO_OPTIONS = {
  automaticLayout: true,
  contextmenu: true,
  cursorBlinking: "smooth" as const,
  cursorSmoothCaretAnimation: "on" as const,
<<<<<<< HEAD
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  fontSize: 18,
=======
  cursorWidth: 2,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  fontSize: 18,
  fontWeight: "500",
  letterSpacing: 0.2,
>>>>>>> f6620dd (Complete Formix updates)
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 12,
  lineHeight: 30,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 3,
  minimap: { enabled: true, renderCharacters: false, maxColumn: 120, scale: 1 },
  overviewRulerBorder: false,
<<<<<<< HEAD
  overviewRulerLanes: 0,
  quickSuggestions: { other: true, comments: false, strings: true },
  renderLineHighlight: "line" as const,
  renderValidationDecorations: "on" as const,
  renderWhitespace: "none" as const,
=======
  // Non-zero so compiler error/warning markers show as a colored strip
  // alongside the minimap — matches VS Code's "problems at a glance" affordance.
  overviewRulerLanes: 3,
  quickSuggestions: { other: true, comments: false, strings: true },
  renderLineHighlight: "all" as const,
  renderLineHighlightOnlyWhenFocus: false,
  renderValidationDecorations: "on" as const,
  renderWhitespace: "none" as const,
  matchBrackets: "always" as const,
>>>>>>> f6620dd (Complete Formix updates)
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    horizontalScrollbarSize: 8,
    verticalScrollbarSize: 8,
<<<<<<< HEAD
=======
    useShadows: true,
>>>>>>> f6620dd (Complete Formix updates)
  },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  suggest: { showWords: true },
  parameterHints: { enabled: true },
<<<<<<< HEAD
  hover: { enabled: true },
  folding: true,
=======
  hover: { enabled: true, delay: 200 },
  folding: true,
  foldingHighlight: true,
  showFoldingControls: "mouseover" as const,
>>>>>>> f6620dd (Complete Formix updates)
  glyphMargin: true,
  bracketPairColorization: { enabled: true },
  guides: { indentation: true, bracketPairs: true, highlightActiveIndentation: true },
  colorDecorators: false,
  occurrencesHighlight: "singleFile" as const,
  selectionHighlight: true,
  wordWrap: "off" as const,
  codeLens: false,
  links: true,
  autoIndent: "full" as const,
  formatOnPaste: true,
  tabSize: 2,
  stickyScroll: { enabled: true, maxLineCount: 3 },
  padding: { top: 24, bottom: 80 },
};

// ── Monarch tokenizer ────────────────────────────────────────────────────────
// Kept in sync with the keyword list above. Comments use `--` (SQL/Lua-style).

export const FORML_MONARCH_TOKENIZER = {
  tokenizer: {
    root: [
      [
<<<<<<< HEAD
        /\b(?:form|field|ui|validate|action|submit|option|required|minLength|maxLength|pattern|min|max|POST|PUT|PATCH|text|email|select|radio|checkbox|integer|float|date|boolean|url|label|placeholder|helpText|endpoint|method|default|bind|page|section|group|use|var|repeat|count|if|else|on|compute|from|map|row|column|load|change|blur|hide|show|clear|set|navigate)\b/,
=======
        /\b(?:form|field|ui|validate|action|submit|option|required|minLength|maxLength|pattern|min|max|accept|maxSize|multiple|minFiles|maxFiles|POST|PUT|PATCH|text|email|select|radio|checkbox|upload|file|image|pdf|document|integer|float|date|boolean|url|label|placeholder|helpText|endpoint|method|default|bind|page|section|group|use|var|repeat|count|if|else|on|compute|from|map|row|column|load|change|blur|hide|show|clear|set|navigate)\b/,
>>>>>>> f6620dd (Complete Formix updates)
        "keyword",
      ],
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
} as const;

// ── Theme ────────────────────────────────────────────────────────────────────
// "formix-mono" — a calm dark theme tuned for the brown/purple Formix palette.

export const FORML_THEME: MonacoTheme = {
  base: "vs-dark",
  inherit: false,
  rules: [
    { token: "", foreground: "EDEDEB" },
    { token: "keyword", foreground: "C4B5FD", fontStyle: "bold" },
    { token: "string", foreground: "A5D6A7" },
    { token: "string.invalid", foreground: "FCA5A5" },
    { token: "number", foreground: "F9C978" },
    { token: "delimiter", foreground: "A78BFA" },
    { token: "operator", foreground: "F0ABFC" },
    { token: "identifier", foreground: "D4D4D8" },
    { token: "comment", foreground: "71717A", fontStyle: "italic" },
  ],
  colors: {
<<<<<<< HEAD
    "editor.background": "#1E1E1E",
    "editor.foreground": "#F4F4F5",
    "editorLineNumber.foreground": "#52525B",
    "editorLineNumber.activeForeground": "#A1A1AA",
    "editorGutter.background": "#1E1E1E",
    "editorCursor.foreground": "#C4B5FD",
    "editor.selectionBackground": "#8B5CF64D",
    "editor.inactiveSelectionBackground": "#8B5CF626",
    "editor.lineHighlightBackground": "#242424",
    "editor.lineHighlightBorder": "#2D2D2D",
    "editorIndentGuide.background1": "#2A2A2A",
    "editorIndentGuide.activeBackground1": "#4C3A77",
    "editorWhitespace.foreground": "#303030",
    "editorWidget.background": "#242424",
    "editorWidget.border": "#3F3F46",
=======
    "editor.background": "#0f172a",
    "editor.foreground": "#F4F4F5",
    "editorLineNumber.foreground": "#475569",
    "editorLineNumber.activeForeground": "#a1a1aa",
    "editorGutter.background": "#0f172a",
    "editorCursor.foreground": "#C4B5FD",
    "editor.selectionBackground": "#8B5CF64D",
    "editor.inactiveSelectionBackground": "#8B5CF626",
    "editor.lineHighlightBackground": "#16213b",
    "editor.lineHighlightBorder": "#1e293b",
    "editorIndentGuide.background1": "#1e293b",
    "editorIndentGuide.activeBackground1": "#4C3A77",
    "editorWhitespace.foreground": "#1e293b",
    "editorWidget.background": "#16213b",
    "editorWidget.border": "#334155",
>>>>>>> f6620dd (Complete Formix updates)
    "editorWidget.foreground": "#EDEDEB",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#FFFFFF0A",
    "scrollbarSlider.hoverBackground": "#FFFFFF18",
    "scrollbarSlider.activeBackground": "#FFFFFF28",
    "editorOverviewRuler.border": "#00000000",
<<<<<<< HEAD
    "focusBorder": "#7C6FE040",
    "editorError.foreground": "#E05252",
    "editorWarning.foreground": "#C4A35A",
=======
    "focusBorder": "#8B5CF640",
    "editorError.foreground": "#E05252",
    "editorWarning.foreground": "#C4A35A",
    "editorInfo.foreground": "#8B5CF6",
    "editorOverviewRuler.errorForeground": "#E05252",
    "editorOverviewRuler.warningForeground": "#C4A35A",
    "editorOverviewRuler.infoForeground": "#8B5CF6",
    // Suggest / hover widgets — explicit so they stay on-theme (inherit: false
    // means these would otherwise fall back to Monaco's generic defaults).
    "editorSuggestWidget.background": "#16213b",
    "editorSuggestWidget.border": "#334155",
    "editorSuggestWidget.foreground": "#D4D4D8",
    "editorSuggestWidget.selectedBackground": "#8B5CF633",
    "editorSuggestWidget.highlightForeground": "#C4B5FD",
    "editorHoverWidget.background": "#16213b",
    "editorHoverWidget.border": "#334155",
    "editorHoverWidget.foreground": "#D4D4D8",
    // Bracket matching + pair colorization, tuned to the Formix palette
    // instead of Monaco's default rainbow.
    "editorBracketMatch.background": "#8B5CF633",
    "editorBracketMatch.border": "#8B5CF680",
    "editorBracketHighlight.foreground1": "#C4B5FD",
    "editorBracketHighlight.foreground2": "#F9C978",
    "editorBracketHighlight.foreground3": "#A5D6A7",
    "editorBracketHighlight.foreground4": "#F0ABFC",
    "editorBracketHighlight.foreground5": "#7DD3FC",
    "editorBracketHighlight.foreground6": "#FCA5A5",
    "editorBracketHighlight.unexpectedBracket.foreground": "#E05252",
    "editorBracketPairGuide.background1": "#C4B5FD1A",
    "editorBracketPairGuide.background2": "#F9C9781A",
    "editorBracketPairGuide.background3": "#A5D6A71A",
    // Folding + gutter
    "editorGutter.foldingControlForeground": "#71717A",
    "editor.foldBackground": "#8B5CF60D",
>>>>>>> f6620dd (Complete Formix updates)
  },
};

// ── Language configuration ───────────────────────────────────────────────────
// Auto-closing pairs, bracket matching, comment toggling, and smart indent
// after `{`. This is what makes typing FormL feel native instead of like a
// plain text box.

export const FORML_LANGUAGE_CONFIG = {
  comments: { lineComment: "--" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
  ],
  onEnterRules: [
    {
      // Indent one level after an opening brace on its own line.
      beforeText: /\{\s*$/,
      action: { indentAction: 1, appendText: "  " }, // 1 = IndentAction.Indent
    },
  ],
<<<<<<< HEAD
=======
  // Lets Monaco auto-dedent as soon as you type a closing brace, and
  // re-indent pasted/typed lines based on brace nesting — the same
  // mechanism built-in languages (JSON, TS) use.
  indentationRules: {
    increaseIndentPattern: /\{[^}"']*$/,
    decreaseIndentPattern: /^\s*[}\])]/,
  },
>>>>>>> f6620dd (Complete Formix updates)
};

// ── Registration helper ──────────────────────────────────────────────────────
// Idempotent: safe to call from every editor's beforeMount / onMount.

let _registered = false;

export function defineFormixMono(monaco: MonacoLike | unknown): void {
  const m = monaco as MonacoLike;
  const languageId = "forml";

  if (!m.languages.getLanguages().some((l) => l.id === languageId)) {
    m.languages.register({ id: languageId });
  }

  m.languages.setMonarchTokensProvider(
    languageId,
    FORML_MONARCH_TOKENIZER as unknown as Record<string, unknown>,
  );

  m.languages.setLanguageConfiguration(
    languageId,
    FORML_LANGUAGE_CONFIG as unknown as Record<string, unknown>,
  );

  m.editor.defineTheme("formix-mono", FORML_THEME);

  // Mark that the language service (completions, hovers) can be attached.
  // The language service itself is registered separately by
  // lib/monaco-forml-language.ts because it needs the full monaco type
  // (CompletionItem kinds etc.).
  _registered = true;
}

export function isFormlRegistered(): boolean {
  return _registered;
}
<<<<<<< HEAD
=======

// ── Format Document ──────────────────────────────────────────────────────────
// A lightweight, brace-depth re-indenter for the editor's "Format Document"
// command (Shift+Alt+F). This is purely a text transform over already-typed
// source — it does not parse or validate FormL, so it has no bearing on the
// compiler pipeline. Comments (`-- ...`) are excluded from brace counting so
// braces used in example text don't skew indentation.

export function formatFormlSource(source: string): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let depth = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      out.push("");
      continue;
    }

    const commentIdx = trimmed.indexOf("--");
    const codePart = commentIdx === -1 ? trimmed : trimmed.slice(0, commentIdx);

    const leadingClosers = (codePart.match(/^[}\])]+/) ?? [""])[0].length;
    const lineDepth = Math.max(0, depth - leadingClosers);
    out.push("  ".repeat(lineDepth) + trimmed);

    let net = 0;
    let inString = false;
    for (let i = 0; i < codePart.length; i++) {
      const ch = codePart[i];
      if (ch === '"' && codePart[i - 1] !== "\\") inString = !inString;
      if (inString) continue;
      if (ch === "{" || ch === "[" || ch === "(") net++;
      else if (ch === "}" || ch === "]" || ch === ")") net--;
    }
    depth = Math.max(0, depth + net);
  }

  return out.join("\n");
}
>>>>>>> f6620dd (Complete Formix updates)
