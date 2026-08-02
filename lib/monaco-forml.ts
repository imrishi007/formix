// lib/monaco-forml.ts
//
// Shared Monaco configuration for the "forml" language: theme, Monarch
// tokenizer, editor options, and the minimal Monaco typings we need without
// pulling in the (very heavy) monaco type package at runtime.
//
// Used by:
//   - components/workspace/editor-pane.tsx      (the author workspace)
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
  base: "vs" | "vs-dark";
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
  "select", "radio", "checkbox", "upload",
  "file", "image", "pdf", "document", // deprecated, kept for old source
  // Blocks
  "ui", "validate", "action", "submit", "option",
  "compute", "from", "map", "row", "column",
  // Validation rules
  "required", "minLength", "maxLength", "pattern", "min", "max",
  // Upload-block rules (also legacy validate-block rules for file/image/pdf/document)
  "accept", "maxSize", "multiple", "minFiles", "maxFiles",
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
  "select", "radio", "checkbox", "upload",
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
  cursorWidth: 2,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  fontSize: 18,
  fontWeight: "500",
  letterSpacing: 0.2,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 12,
  lineHeight: 30,
  lineNumbers: "on" as const,
  lineNumbersMinChars: 3,
  minimap: { enabled: true, renderCharacters: false, maxColumn: 120, scale: 1 },
  overviewRulerBorder: false,
  // Non-zero so compiler error/warning markers show as a colored strip
  // alongside the minimap — matches VS Code's "problems at a glance" affordance.
  overviewRulerLanes: 3,
  quickSuggestions: { other: true, comments: false, strings: true },
  renderLineHighlight: "all" as const,
  renderLineHighlightOnlyWhenFocus: false,
  renderValidationDecorations: "on" as const,
  renderWhitespace: "none" as const,
  matchBrackets: "always" as const,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    horizontalScrollbarSize: 8,
    verticalScrollbarSize: 8,
    useShadows: true,
  },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  suggest: { showWords: true },
  parameterHints: { enabled: true },
  hover: { enabled: true, delay: 200 },
  folding: true,
  foldingHighlight: true,
  showFoldingControls: "mouseover" as const,
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
      // Order matters: field types and attribute keys are also in the keyword
      // list below, so they must match FIRST to win their own token. This is
      // what lets the dark theme color types green and property names gray
      // (design.md §Code editor syntax colors) instead of lumping them in
      // with structure keywords. The light theme's rules reproduce the old
      // all-mauve look exactly, so nothing changes visually in light.
      [
        /\b(?:text|integer|float|email|date|boolean|url|select|radio|checkbox|upload)\b/,
        "type",
      ],
      [
        /\b(?:label|placeholder|helpText|endpoint|method|default|bind)\b/,
        "property",
      ],
      [
        /\b(?:form|field|ui|validate|action|submit|option|required|minLength|maxLength|pattern|min|max|accept|maxSize|multiple|minFiles|maxFiles|POST|PUT|PATCH|page|section|group|use|var|repeat|count|if|else|on|compute|from|map|row|column|load|change|blur|hide|show|clear|set|navigate|file|image|pdf|document)\b/,
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

// ── Themes ────────────────────────────────────────────────────────────────────
// The Monaco canvas follows the app theme (design.md §Code Editor — the
// reverse of the old "always dark" rule):
//   - Dark  → FORML_THEME_MOCHA, design.md v3 syntax colors: blue keywords,
//     soft-green types, muted-amber strings, muted-gray comments, on the
//     app's bg-surface #0F1522. No mauve/violet (Catppuccin palette removed).
//   - Light → FORML_THEME_LATTE, the original palette, LOCKED/untouched.
// Only the canvas is themed here; tab bars / explorer / status bars keep the
// app's own tokens (--bg-surface etc.), so chrome and code read as one surface.
// Theme names are exported so editor components can hand them to Monaco's
// `theme` prop and swap live when the app theme toggles.

export const FORML_THEME_DARK = "formix-mocha";
export const FORML_THEME_LIGHT = "formix-latte";

// Formix dark — design.md v3 syntax colors (NOT Catppuccin; that palette's
// mauve/pink is gone entirely). Reference:
// keywords → accent blue #5B8DEF · types → soft green #4ADE80 ·
// strings → muted warm amber #E0B989 · comments → muted gray #5C6779 ·
// numbers → warm orange #F0A868 · operators → soft green · property names
// → muted blue-gray #9AA4B8 · editor canvas → bg-surface #0F1522
export const FORML_THEME_MOCHA: MonacoTheme = {
  base: "vs-dark",
  inherit: false,
  rules: [
    { token: "", foreground: "E6E9F0" },
    { token: "keyword", foreground: "5B8DEF" },
    { token: "type", foreground: "4ADE80" },
    { token: "property", foreground: "9AA4B8" },
    { token: "string", foreground: "E0B989" },
    { token: "string.invalid", foreground: "F87171" },
    { token: "number", foreground: "F0A868" },
    { token: "delimiter", foreground: "9AA4B8" },
    { token: "operator", foreground: "4ADE80" },
    { token: "identifier", foreground: "E6E9F0" },
    { token: "comment", foreground: "5C6779", fontStyle: "italic" },
  ],
  colors: {
    // Canvas sits on the app's own surface token so chrome and code read as
    // one surface (design.md §Code Editor).
    "editor.background": "#0F1522",
    "editor.foreground": "#e6e9f0",
    "editorLineNumber.foreground": "#5C6779",
    "editorLineNumber.activeForeground": "#e6e9f0",
    "editorGutter.background": "#0F1522",
    "editorCursor.foreground": "#5B8DEF",
    "editor.selectionBackground": "#5B8DEF44",
    "editor.inactiveSelectionBackground": "#2A3348",
    "editor.lineHighlightBackground": "#141B2B",
    "editor.lineHighlightBorder": "#141B2B",
    "editorIndentGuide.background1": "#1E2536",
    "editorIndentGuide.activeBackground1": "#2A3348",
    "editorWhitespace.foreground": "#1E2536",
    "editorWidget.background": "#141B2B",
    "editorWidget.border": "#2A3348",
    "editorWidget.foreground": "#e6e9f0",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#1E2536",
    "scrollbarSlider.hoverBackground": "#2A3348",
    "scrollbarSlider.activeBackground": "#5C6779",
    "editorOverviewRuler.border": "#00000000",
    "focusBorder": "#5B8DEF66",
    "editorError.foreground": "#f87171",
    "editorWarning.foreground": "#fbbf24",
    "editorInfo.foreground": "#5b8def",
    "editorOverviewRuler.errorForeground": "#f87171",
    "editorOverviewRuler.warningForeground": "#fbbf24",
    "editorOverviewRuler.infoForeground": "#5b8def",
    "editorSuggestWidget.background": "#141B2B",
    "editorSuggestWidget.border": "#2A3348",
    "editorSuggestWidget.foreground": "#e6e9f0",
    "editorSuggestWidget.selectedBackground": "#1E2536",
    "editorSuggestWidget.highlightForeground": "#5B8DEF",
    "editorHoverWidget.background": "#141B2B",
    "editorHoverWidget.border": "#2A3348",
    "editorHoverWidget.foreground": "#e6e9f0",
    // Bracket matching + pair colorization — design.md palette (no mauve/pink)
    "editorBracketMatch.background": "#2A3348",
    "editorBracketMatch.border": "#5C6779",
    "editorBracketHighlight.foreground1": "#5b8def",
    "editorBracketHighlight.foreground2": "#4ade80",
    "editorBracketHighlight.foreground3": "#e0b989",
    "editorBracketHighlight.foreground4": "#f87171",
    "editorBracketHighlight.foreground5": "#fbbf24",
    "editorBracketHighlight.foreground6": "#2dd4bf",
    "editorBracketHighlight.unexpectedBracket.foreground": "#f87171",
    "editorBracketPairGuide.background1": "#5b8def1a",
    "editorBracketPairGuide.background2": "#4ade801a",
    "editorBracketPairGuide.background3": "#e0b9891a",
    "editorGutter.foldingControlForeground": "#5C6779",
    "editor.foldBackground": "#141B2B",
  },
};

// Catppuccin Latte — light. Reference tokens (design.md):
// base #eff1f5 · mantle #e6e9ef · text #4c4f69 · blue #1e66f5 ·
// mauve #8839ef · green #40a02b · yellow #df8e1d · peach #fe640b ·
// red #d20f39
export const FORML_THEME_LATTE: MonacoTheme = {
  base: "vs",
  inherit: false,
  rules: [
    { token: "", foreground: "4C4F69" },
    { token: "keyword", foreground: "8839EF" },
    // type/property tokens exist so the DARK theme can color them distinctly
    // (design.md); light theme keeps them the old mauve to stay untouched.
    { token: "type", foreground: "8839EF" },
    { token: "property", foreground: "8839EF" },
    { token: "string", foreground: "40A02B" },
    { token: "string.invalid", foreground: "D20F39" },
    { token: "number", foreground: "FE640B" },
    { token: "delimiter", foreground: "1E66F5" },
    { token: "operator", foreground: "1E66F5" },
    { token: "identifier", foreground: "4C4F69" },
    { token: "comment", foreground: "6C6F85", fontStyle: "italic" },
  ],
  colors: {
    "editor.background": "#eff1f5",
    "editor.foreground": "#4c4f69",
    "editorLineNumber.foreground": "#bcc0cc",
    "editorLineNumber.activeForeground": "#4c4f69",
    "editorGutter.background": "#eff1f5",
    "editorCursor.foreground": "#7287fd",
    "editor.selectionBackground": "#acb0be",
    "editor.inactiveSelectionBackground": "#bcc0cc",
    "editor.lineHighlightBackground": "#e6e9ef",
    "editor.lineHighlightBorder": "#e6e9ef",
    "editorIndentGuide.background1": "#ccd0da",
    "editorIndentGuide.activeBackground1": "#6c6f85",
    "editorWhitespace.foreground": "#ccd0da",
    "editorWidget.background": "#e6e9ef",
    "editorWidget.border": "#bcc0cc",
    "editorWidget.foreground": "#4c4f69",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ccd0da",
    "scrollbarSlider.hoverBackground": "#bcc0cc",
    "scrollbarSlider.activeBackground": "#acb0be",
    "editorOverviewRuler.border": "#00000000",
    "focusBorder": "#1e66f555",
    "editorError.foreground": "#d20f39",
    "editorWarning.foreground": "#df8e1d",
    "editorInfo.foreground": "#1e66f5",
    "editorOverviewRuler.errorForeground": "#d20f39",
    "editorOverviewRuler.warningForeground": "#df8e1d",
    "editorOverviewRuler.infoForeground": "#1e66f5",
    "editorSuggestWidget.background": "#e6e9ef",
    "editorSuggestWidget.border": "#bcc0cc",
    "editorSuggestWidget.foreground": "#4c4f69",
    "editorSuggestWidget.selectedBackground": "#ccd0da",
    "editorSuggestWidget.highlightForeground": "#1e66f5",
    "editorHoverWidget.background": "#e6e9ef",
    "editorHoverWidget.border": "#bcc0cc",
    "editorHoverWidget.foreground": "#4c4f69",
    "editorBracketMatch.background": "#acb0be",
    "editorBracketMatch.border": "#6c6f85",
    "editorBracketHighlight.foreground1": "#1e66f5",
    "editorBracketHighlight.foreground2": "#8839ef",
    "editorBracketHighlight.foreground3": "#179299",
    "editorBracketHighlight.foreground4": "#d20f39",
    "editorBracketHighlight.foreground5": "#df8e1d",
    "editorBracketHighlight.foreground6": "#ea76cb",
    "editorBracketHighlight.unexpectedBracket.foreground": "#d20f39",
    "editorBracketPairGuide.background1": "#1e66f51a",
    "editorBracketPairGuide.background2": "#8839ef1a",
    "editorBracketPairGuide.background3": "#1792991a",
    "editorGutter.foldingControlForeground": "#6c6f85",
    "editor.foldBackground": "#e6e9ef",
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
  // Lets Monaco auto-dedent as soon as you type a closing brace, and
  // re-indent pasted/typed lines based on brace nesting — the same
  // mechanism built-in languages (JSON, TS) use.
  indentationRules: {
    increaseIndentPattern: /\{[^}"']*$/,
    decreaseIndentPattern: /^\s*[}\])]/,
  },
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

  // Register both Catppuccin canvas themes up front so editor components can
  // swap between them reactively via Monaco's `theme` prop.
  m.editor.defineTheme(FORML_THEME_DARK, FORML_THEME_MOCHA);
  m.editor.defineTheme(FORML_THEME_LIGHT, FORML_THEME_LATTE);

  // Mark that the language service (completions, hovers) can be attached.
  // The language service itself is registered separately by
  // lib/monaco-forml-language.ts because it needs the full monaco type
  // (CompletionItem kinds etc.).
  _registered = true;
}

export function isFormlRegistered(): boolean {
  return _registered;
}

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
