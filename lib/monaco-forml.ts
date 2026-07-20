// lib/monaco-forml.ts
//
// Shared Monaco configuration for the "forml" language: theme, Monarch
// tokenizer, editor options, and the minimal Monaco typings we need without
// pulling in the (very heavy) monaco type package at runtime.
//
// Used by:
//   - components/editor/demo-ide-shell.tsx     (the author IDE)
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
  "select", "radio", "checkbox",
  // Blocks
  "ui", "validate", "action", "submit", "option",
  "compute", "from", "map", "row", "column",
  // Validation rules
  "required", "minLength", "maxLength", "pattern", "min", "max",
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
  "select", "radio", "checkbox",
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
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  fontSize: 18,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 12,
  lineHeight: 30,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 3,
  minimap: { enabled: true, renderCharacters: false, maxColumn: 120, scale: 1 },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  quickSuggestions: { other: true, comments: false, strings: true },
  renderLineHighlight: "line" as const,
  renderValidationDecorations: "on" as const,
  renderWhitespace: "none" as const,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    horizontalScrollbarSize: 8,
    verticalScrollbarSize: 8,
  },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  suggest: { showWords: true },
  parameterHints: { enabled: true },
  hover: { enabled: true },
  folding: true,
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
        /\b(?:form|field|ui|validate|action|submit|option|required|minLength|maxLength|pattern|min|max|POST|PUT|PATCH|text|email|select|radio|checkbox|integer|float|date|boolean|url|label|placeholder|helpText|endpoint|method|default|bind|page|section|group|use|var|repeat|count|if|else|on|compute|from|map|row|column|load|change|blur|hide|show|clear|set|navigate)\b/,
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
