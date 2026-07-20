"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormlCompiler } from "@/lib/use-forml-compiler";
import {
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";

const DEFAULT_DSL = `form "Customer Feedback" {
  field name : text
    ui {
      label: "Your Name"
      placeholder: "John Doe"
    }
    validate { required }

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
}`;

// ─── Skeleton parser ────────────────────────────────────────────────────────
// Scans the DSL text and extracts fields to render a live form preview
// while the real WASM compiler is loading. Once wasmReady flips true,
// the component switches to the real compiled output.

type MockField = {
  name: string;
  type: "text" | "email" | "url" | "integer" | "float" | "boolean" | "date" | "select" | "radio" | "checkbox";
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
};

type ParseResult = {
  formName: string;
  fields: MockField[];
  error: string | null;
};

type PreviewMode = "ui" | "ast";

type AstField = {
  type: "Field";
  name: string;
  dataType: MockField["type"];
  options: string[];
  source: null;
  ui: {
    label: string;
    placeholder: string | null;
    helpText: string | null;
    default: null;
    bind: null;
  };
  validation: {
    required: boolean;
    min: null;
    max: null;
    minLength: null;
    maxLength: null;
    pattern: null;
  };
  compute: null;
  trigger: null;
};

type MockAst = {
  type: "Form";
  name: string;
  variables: [];
  groups: [];
  pages: [];
  body: AstField[];
  action: null;
};

function mockParse(dsl: string): ParseResult {
  try {
    // Extract form name
    const formNameMatch = dsl.match(/form\s+"([^"]+)"/);
    const formName = formNameMatch ? formNameMatch[1] : "Untitled Form";

    const fields: MockField[] = [];
    // Match field declarations
    const fieldRegex = /field\s+(\w+)\s*:\s*(text|email|url|integer|float|boolean|date|select|radio|checkbox)/g;
    let match;

    while ((match = fieldRegex.exec(dsl)) !== null) {
      const [, name, rawType] = match;
      const type = rawType as MockField["type"];
      const fieldStart = match.index;

      // Find the block after this field declaration (up to next field or end)
      const afterField = dsl.slice(fieldStart + match[0].length);
      const nextFieldIdx = afterField.search(/field\s+\w+\s*:/);
      const block = nextFieldIdx === -1 ? afterField : afterField.slice(0, nextFieldIdx);

      // Extract ui block properties
      const labelMatch = block.match(/label:\s*"([^"]+)"/);
      const placeholderMatch = block.match(/placeholder:\s*"([^"]+)"/);
      const helpTextMatch = block.match(/helpText:\s*"([^"]+)"/);
      const requiredMatch = block.match(/required/);

      // Extract select/radio/checkbox options
      const options: string[] = [];
      const optionRegex = /option\s+"([^"]+)"/g;
      let optMatch;
      while ((optMatch = optionRegex.exec(block)) !== null) {
        options.push(optMatch[1]);
      }

      fields.push({
        name,
        type,
        label: labelMatch ? labelMatch[1] : name.charAt(0).toUpperCase() + name.slice(1),
        placeholder: placeholderMatch ? placeholderMatch[1] : undefined,
        helpText: helpTextMatch ? helpTextMatch[1] : undefined,
        required: !!requiredMatch,
        options: options.length > 0 ? options : undefined,
      });
    }

    if (fields.length === 0 && dsl.trim().length > 0 && !dsl.includes("form")) {
      return { formName: "", fields: [], error: "[ParseError] Line 1, Col 1: Expected 'form' keyword." };
    }

    return { formName, fields, error: null };
  } catch {
    return { formName: "", fields: [], error: "[ParseError] Unexpected syntax." };
  }
}

function buildMockAst(parsed: ParseResult): MockAst {
  return {
    type: "Form",
    name: parsed.formName || "Untitled Form",
    variables: [],
    groups: [],
    pages: [],
    body: parsed.fields.map((field) => ({
      type: "Field",
      name: field.name,
      dataType: field.type,
      options: field.options ?? [],
      source: null,
      ui: {
        label: field.label,
        placeholder: field.placeholder ?? null,
        helpText: field.helpText ?? null,
        default: null,
        bind: null,
      },
      validation: {
        required: field.required ?? false,
        min: null,
        max: null,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
      compute: null,
      trigger: null,
    })),
    action: null,
  };
}

function JsonTree({ value }: { value: MockAst }) {
  const json = JSON.stringify(value, null, 2);
  const lines = json.split("\n");

  return (
    <pre className="font-mono text-xs leading-6 text-foreground/75 whitespace-pre-wrap">
      {lines.map((line, index) => {
        const keyMatch = line.match(/^(\s*)"([^"]+)":(.*)$/);

        if (!keyMatch) {
          return <span key={`${line}-${index}`}>{line}{index < lines.length - 1 ? "\n" : ""}</span>;
        }

        const [, indent, key, rest] = keyMatch;
        return (
          <span key={`${key}-${index}`}>
            <span>{indent}</span>
            <span className="text-foreground">"{key}"</span>
            <span className="text-foreground/40">:</span>
            <span>{rest}</span>
            {index < lines.length - 1 ? "\n" : ""}
          </span>
        );
      })}
    </pre>
  );
}

// ─── Form Field Renderer ─────────────────────────────────────────────────────

function PreviewField({ field }: { field: MockField }) {
  const inputClass =
    "w-full border border-foreground/15 bg-background px-3 py-2 text-sm font-sans focus:outline-none focus:border-foreground/40 transition-colors";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-sans font-medium flex items-center gap-1.5">
        {field.label}
        {field.required && (
          <span className="text-xs text-destructive font-mono">*</span>
        )}
      </label>

      {field.type === "boolean" ? (
        <div className="flex items-center gap-2">
          <input type="checkbox" className="w-4 h-4 border border-foreground/20" />
          <span className="text-sm text-muted-foreground">{field.label}</span>
        </div>
      ) : field.type === "select" && field.options ? (
        <select className={inputClass}>
          <option value="">Select an option</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === "radio" && field.options ? (
        <div className="flex flex-col gap-2">
          {field.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={field.name} value={opt} className="w-4 h-4" />
              {opt}
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" && field.options ? (
        <div className="flex flex-col gap-2">
          {field.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" value={opt} className="w-4 h-4" />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <input
          type={
            field.type === "email" ? "email"
            : field.type === "url" ? "url"
            : field.type === "date" ? "date"
            : field.type === "integer" || field.type === "float" ? "number"
            : "text"
          }
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.helpText && (
        <p className="text-xs text-muted-foreground leading-relaxed">{field.helpText}</p>
      )}
    </div>
  );
}

// ─── Main Demo Section ────────────────────────────────────────────────────────

export function DemoSection() {
  const { ready: wasmReady, compile } = useFormlCompiler();

  const [dsl, setDsl] = useState(DEFAULT_DSL);
  // Skeleton parse used only to render *something* before the WASM compiler
  // finishes loading (~1s on first visit). Once wasmReady flips true we
  // switch exclusively to real compiler output.
  const [skeleton, setSkeleton] = useState<ParseResult>(() => mockParse(DEFAULT_DSL));
  const [compileResult, setCompileResult] = useState<{
    ast: ASTNode | null;
    diagnostics: { line: number; col: number; severity: string; message: string }[];
    ok: boolean;
    durationMs: number;
  } | null>(null);
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("ui");
  const [isVisible, setIsVisible] = useState(false);
  const [lineCount, setLineCount] = useState(DEFAULT_DSL.split("\n").length);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const sectionRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const compileTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Run the real WASM compile on a 300ms debounce.
  const runCompile = useCallback((src: string) => {
    if (!wasmReady) return;
    const result = compile(src);
    setCompileResult({
      ast: (result.ast ?? null) as ASTNode | null,
      diagnostics: result.diagnostics,
      ok: result.ok,
      durationMs: result.durationMs,
    });
    setCompileMs(result.durationMs);
  }, [wasmReady, compile]);

  // Compile once as soon as the WASM runtime is ready.
  useEffect(() => {
    if (!wasmReady) return;
    runCompile(dsl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasmReady]);

  useEffect(() => () => {
    if (compileTimerRef.current) window.clearTimeout(compileTimerRef.current);
  }, []);

  const handleDslChange = (value: string) => {
    setDsl(value);
    setSkeleton(mockParse(value)); // cheap skeleton, replaced by real output below
    setLineCount(value.split("\n").length);
    if (wasmReady) {
      if (compileTimerRef.current) window.clearTimeout(compileTimerRef.current);
      compileTimerRef.current = window.setTimeout(() => runCompile(value), 300);
    }
  };

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Real compiled form (preferred) — falls back to skeleton only while WASM
  // is still loading so the panel is never blank.
  const realAst = compileResult?.ast ?? null;
  const realFormName = (realAst?.name as string) ?? "";
  const realFieldCount = useMemo(() => {
    if (!realAst) return 0;
    const countRecursive = (stmts: ASTNode[] | undefined): number => {
      if (!Array.isArray(stmts)) return 0;
      let n = 0;
      for (const s of stmts) {
        const t = s.type as string;
        if (t === "Field") n += 1;
        else if (t === "Page" || t === "Section" || t === "Layout") {
          n += countRecursive(s.statements as ASTNode[] | undefined);
        } else if (t === "Conditional") {
          n += countRecursive(s.then as ASTNode[] | undefined);
          n += countRecursive(s.else as ASTNode[] | undefined);
        }
      }
      return n;
    };
    return countRecursive(realAst.statements as ASTNode[] | undefined)
      + countRecursive(realAst.pages as ASTNode[] | undefined);
  }, [realAst]);

  const realStatements: ASTNode[] = useMemo(() => {
    if (!realAst) return [];
    const pages = (realAst.pages as ASTNode[]) ?? [];
    const stmts = (realAst.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [realAst]);

  const handleFieldChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  // The form name + field count shown in the toolbar come from whichever
  // source is live: real compiler output once available, skeleton otherwise.
  const displayFormName = wasmReady && realAst ? (realFormName || skeleton.formName) : skeleton.formName;
  const displayFieldCount = wasmReady && realAst ? realFieldCount : skeleton.fields.length;
  const compileError = wasmReady && compileResult && !compileResult.ok
    ? compileResult.diagnostics.find((d) => d.severity === "error")?.message ?? "Compile error"
    : null;

  const handleSubmitClick = () => {
    setDemoNotice("This is a landing-page demo. Submissions are disabled here — open the editor to publish a real form.");
    window.setTimeout(() => setDemoNotice(null), 4000);
  };

  return (
    <section
      id="demo"
      ref={sectionRef}
      className="relative py-24 lg:py-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          className={`mb-12 lg:mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            -- Demo
          </span>
          <div className="grid lg:grid-cols-2 gap-6 items-end">
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
              Type DSL.
              <br />
              <span className="text-muted-foreground">See form.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              Edit the Forml code on the left. The form on the right updates in
              real-time — parsed entirely in your browser via WebAssembly.
            </p>
          </div>
        </div>

        {/* Two-panel editor */}
        <div
          className={`border border-foreground/15 overflow-hidden transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-foreground/10">

            {/* ── Left: DSL Editor ── */}
            <div className="bg-foreground text-background flex flex-col">
              {/* Editor toolbar */}
              <div className="px-5 py-3.5 border-b border-background/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-background/20" />
                    <div className="w-3 h-3 rounded-full bg-background/20" />
                    <div className="w-3 h-3 rounded-full bg-background/20" />
                  </div>
                  <span className="text-xs font-mono text-background/40 ml-2">feedback.forml</span>
                </div>
                <span className="text-xs font-mono text-background/30">Forml v1.1</span>
              </div>

              {/* Editor body with line numbers */}
              <div className="flex overflow-hidden" style={{ minHeight: "480px", maxHeight: "560px" }}>
                {/* Line numbers */}
                <div
                  ref={lineNumbersRef}
                  className="select-none py-4 px-3 text-right text-background/20 font-mono text-xs leading-6 overflow-hidden shrink-0 border-r border-background/10"
                  style={{ width: "3rem" }}
                  aria-hidden="true"
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i + 1}>{i + 1}</div>
                  ))}
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={dsl}
                  onChange={(e) => handleDslChange(e.target.value)}
                  onScroll={syncScroll}
                  spellCheck={false}
                  className="flex-1 resize-none bg-transparent text-background/80 font-mono text-xs leading-6 p-4 focus:outline-none overflow-auto"
                  style={{ minHeight: "480px", tabSize: 2 }}
                  aria-label="Forml DSL editor"
                />
              </div>

              {/* Status bar */}
              <div className="px-5 py-2.5 border-t border-background/10 flex items-center justify-between shrink-0">
                {!wasmReady ? (
                  <span className="flex items-center gap-2 text-xs font-mono text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    Initializing compiler…
                  </span>
                ) : compileError ? (
                  <span className="text-xs font-mono text-red-400 truncate">{compileError}</span>
                ) : (
                  <span className="flex items-center gap-2 text-xs font-mono text-background/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Parsed — {displayFieldCount} field{displayFieldCount !== 1 ? "s" : ""}
                    {compileMs !== null && (
                      <span className="ml-1 opacity-60">· {compileMs}ms</span>
                    )}
                  </span>
                )}
                <span className="text-xs font-mono text-background/20 shrink-0 ml-4">
                  {lineCount}L
                </span>
              </div>
            </div>

            {/* ── Right: Live Form Preview ── */}
            <div className="bg-background flex flex-col">
              {/* Preview toolbar */}
              <div className="px-5 py-3.5 border-b border-foreground/10 flex items-center justify-between shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  {displayFormName || "Preview"}
                </span>
                <div className="flex border border-foreground/15">
                  {(["ui", "ast"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                        previewMode === mode
                          ? "bg-[#080503] text-[#FAFAF9]"
                          : "bg-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      }`}
                      aria-pressed={previewMode === mode}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form preview */}
              <div
                className="flex-1 p-8 overflow-auto"
                style={{ minHeight: "480px", maxHeight: "560px" }}
              >
                {compileError ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                    <div className="font-mono text-xs text-destructive/70 bg-destructive/5 border border-destructive/10 p-6 max-w-sm leading-relaxed">
                      {compileError}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fix the DSL to see the form preview
                    </p>
                  </div>
                ) : previewMode === "ast" ? (
                  <JsonTree value={buildMockAst(wasmReady && realAst ? { ...skeleton, formName: realFormName || skeleton.formName, fields: [] } : skeleton)} />
                ) : wasmReady && realStatements.length > 0 ? (
                  /* ── Real WASM-compiled form preview ── */
                  <div className="flex flex-col gap-6">
                    {displayFormName && (
                      <h3 className="text-xl font-display border-b border-foreground/10 pb-4">
                        {displayFormName}
                      </h3>
                    )}
                    <RenderStatements
                      stmts={realStatements}
                      values={formValues}
                      onChange={handleFieldChange}
                    />
                    <button
                      type="button"
                      onClick={handleSubmitClick}
                      className="mt-2 bg-foreground text-background text-sm font-sans px-6 py-2.5 rounded-full hover:bg-foreground/85 transition-colors self-start"
                    >
                      Submit
                    </button>
                    {demoNotice && (
                      <p className="text-xs text-muted-foreground border border-foreground/10 rounded px-3 py-2 mt-1 max-w-sm">
                        {demoNotice}
                      </p>
                    )}
                  </div>
                ) : skeleton.fields.length > 0 && !wasmReady ? (
                  /* ── Skeleton preview while WASM loads ── */
                  <div className="flex flex-col gap-6">
                    {skeleton.formName && (
                      <h3 className="text-xl font-display border-b border-foreground/10 pb-4">
                        {skeleton.formName}
                      </h3>
                    )}
                    {skeleton.fields.map((field) => (
                      <PreviewField key={field.name} field={field} />
                    ))}
                    <button
                      type="button"
                      onClick={handleSubmitClick}
                      className="mt-2 bg-foreground text-background text-sm font-sans px-6 py-2.5 rounded-full hover:bg-foreground/85 transition-colors self-start"
                    >
                      Submit
                    </button>
                    {demoNotice && (
                      <p className="text-xs text-muted-foreground border border-foreground/10 rounded px-3 py-2 mt-1 max-w-sm">
                        {demoNotice}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <p className="text-muted-foreground text-sm font-mono">
                      Start typing a form definition...
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Try: <code className="font-mono">field email : email</code>
                    </p>
                  </div>
                )}
              </div>

              {/* Preview footer */}
              <div className="px-5 py-2.5 border-t border-foreground/10 flex items-center justify-between shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  {wasmReady ? "WASM · client-side" : "Loading compiler…"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  FormL v1.1
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom hint */}
        <p
          className={`mt-6 text-center text-sm font-mono text-muted-foreground transition-all duration-700 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "400ms" }}
        >
          The parser is a hand-written C++ recursive descent compiler compiled to WebAssembly. It runs entirely in your browser — no server involved.
        </p>
      </div>
    </section>
  );
}
