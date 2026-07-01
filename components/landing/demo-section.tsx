"use client";

import { useEffect, useRef, useState } from "react";

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

// ─── Mock parser ─────────────────────────────────────────────────────────────
// Scans the DSL text and extracts fields to render a live form preview.
// This is a lightweight simulation; swap with the real WASM parse() when ready.

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
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [parsed, setParsed] = useState<ParseResult>(() => mockParse(DEFAULT_DSL));
  const [previewMode, setPreviewMode] = useState<PreviewMode>("ui");
  const [isVisible, setIsVisible] = useState(false);
  const [lineCount, setLineCount] = useState(DEFAULT_DSL.split("\n").length);
  const sectionRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDslChange = (value: string) => {
    setDsl(value);
    setParsed(mockParse(value));
    setLineCount(value.split("\n").length);
  };

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
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
                {parsed.error ? (
                  <span className="text-xs font-mono text-red-400 truncate">{parsed.error}</span>
                ) : (
                  <span className="flex items-center gap-2 text-xs font-mono text-background/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Parse OK — {parsed.fields.length} field{parsed.fields.length !== 1 ? "s" : ""}
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
                  {parsed.formName || "Preview"}
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
                {parsed.error ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                    <div className="font-mono text-xs text-destructive/70 bg-destructive/5 border border-destructive/10 p-6 max-w-sm leading-relaxed">
                      {parsed.error}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fix the DSL to see the form preview
                    </p>
                  </div>
                ) : previewMode === "ast" ? (
                  <JsonTree value={buildMockAst(parsed)} />
                ) : parsed.fields.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <p className="text-muted-foreground text-sm font-mono">
                      Start typing a form definition...
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Try: <code className="font-mono">field email : email</code>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {parsed.formName && (
                      <h3 className="text-xl font-display border-b border-foreground/10 pb-4">
                        {parsed.formName}
                      </h3>
                    )}

                    {parsed.fields.map((field) => (
                      <PreviewField key={field.name} field={field} />
                    ))}

                    <button
                      type="button"
                      className="mt-2 bg-foreground text-background text-sm font-sans px-6 py-2.5 rounded-full hover:bg-foreground/85 transition-colors self-start"
                    >
                      Submit
                    </button>
                  </div>
                )}
              </div>

              {/* Preview footer */}
              <div className="px-5 py-2.5 border-t border-foreground/10 flex items-center justify-between shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  ASTRenderer.tsx
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  WASM · client-side
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
          The real parser is a hand-written C++ recursive descent compiler compiled to WebAssembly.
        </p>
      </div>
    </section>
  );
}
