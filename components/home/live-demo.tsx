"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { CodeBlock } from "@/components/docs/code-block";
import { RenderStatements, type ASTNode } from "@/components/form-renderer";
import { generateForm, SUGGESTED_PROMPTS } from "@/lib/ai-engine";
import { useFormlCompiler } from "@/lib/use-forml-compiler";

const CYCLE_MS = 7000;

// Code pane sizing. The window frame is a fixed height and never grows with
// content. Line-height is scaled UP toward CODE_MAX_LINE_HEIGHT for short
// examples, but never scales below CODE_MIN_LINE_HEIGHT — shrinking further
// is what made the code unreadable. Anything that still doesn't fit fades out
// at the bottom with a "+N more lines" pill instead of triggering a scrollbar.
// CODE_CANVAS_PADDING must match the `pt-4` (16px) gutter on the code wrapper.
const CODE_MAX_LINE_HEIGHT = 23;
const CODE_MIN_LINE_HEIGHT = 20;
const CODE_CANVAS_PADDING = 16;

function MacbookFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilted, setTilted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTilted(false);
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="macbook-frame w-full">
      <div
        className={`macbook-screen transition-all duration-600 ${
          tilted ? "macbook-screen-tilt" : "macbook-screen-straight"
        }`}
      >
        <div className="browser-chrome">
          <div className="browser-traffic-lights">
            <span className="browser-dot browser-dot-red" />
            <span className="browser-dot browser-dot-yellow" />
            <span className="browser-dot browser-dot-green" />
          </div>
          <div className="browser-address-bar">localhost:3000/demo</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LiveDemo() {
  const { ready, compile } = useFormlCompiler();
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [demoVisible, setDemoVisible] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setDemoVisible(true); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Exact-fit code pane ─────────────────────────────────────────────
  // The window frame has a FIXED height — it never grows to fit more code.
  // Instead we measure the code canvas and scale font-size + line-height so
  // the full generated FormL always fits exactly, with zero scrolling.
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const [codeAreaHeight, setCodeAreaHeight] = useState(0);

  useEffect(() => {
    const el = codeAreaRef.current;
    if (!el) return;
    const update = () => setCodeAreaHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const prompt = SUGGESTED_PROMPTS[activeIdx];
  const aiResult = useMemo(() => generateForm(prompt), [prompt]);
  const compileResult = useMemo(
    () => (ready ? compile(aiResult.formlCode ?? "") : null),
    [ready, compile, aiResult],
  );
  const ast = (compileResult?.ast as ASTNode | null) ?? null;

  const statements = useMemo<ASTNode[]>(() => {
    if (!ast) return [];
    const pages = (ast.pages as ASTNode[]) ?? [];
    const rootStmts = (ast.statements as ASTNode[]) ?? [];
    return [...pages.flatMap((p) => (p.statements as ASTNode[]) ?? []), ...rootStmts];
  }, [ast]);

  const fieldCount = statements.filter((s) => s.type === "Field").length;

  // ── Code pane layout — scale-to-floor + fade ───────────────────────
  // The frame is a fixed height. Line-height exactly fits the canvas when
  // that lands above the readable floor; otherwise it holds at the floor and
  // the overflow lines are faded out (not scrolled, not shrunk to invisibility).
  const codeLineCount = useMemo(
    () => Math.max(1, (aiResult.formlCode ?? "").split("\n").length),
    [aiResult],
  );

  const codeLayout = useMemo(() => {
    if (codeAreaHeight <= 0) {
      // First paint before measurement: use a comfortable default.
      return { lineHeight: CODE_MIN_LINE_HEIGHT, visibleLines: codeLineCount, hiddenLines: 0 };
    }
    const available = codeAreaHeight - CODE_CANVAS_PADDING - 2;
    if (available / codeLineCount < CODE_MIN_LINE_HEIGHT) {
      const visibleLines = Math.floor(available / CODE_MIN_LINE_HEIGHT);
      return {
        lineHeight: CODE_MIN_LINE_HEIGHT,
        visibleLines,
        hiddenLines: codeLineCount - visibleLines,
      };
    }
    return {
      lineHeight: Math.min(CODE_MAX_LINE_HEIGHT, available / codeLineCount),
      visibleLines: codeLineCount,
      hiddenLines: 0,
    };
  }, [codeAreaHeight, codeLineCount]);

  const codeFontSize = useMemo(
    () => Math.round(codeLayout.lineHeight * 0.62 * 10) / 10,
    [codeLayout],
  );

  // Only render the lines that fit the frame — the fade + count pill tells
  // the viewer the rest is truncated for the mockup (the real form is the
  // full generated source, still compiled by the WASM binary).
  const displayCode = useMemo(() => {
    const src = aiResult.formlCode ?? "";
    if (codeLayout.hiddenLines <= 0) return src;
    return src.split("\n").slice(0, codeLayout.visibleLines).join("\n");
  }, [aiResult, codeLayout]);

  useEffect(() => setFormValues({}), [activeIdx]);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => setActiveIdx((i) => (i + 1) % SUGGESTED_PROMPTS.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [autoCycle]);

  const handlePromptClick = useCallback((i: number) => {
    setAutoCycle(false);
    setActiveIdx(i);
  }, []);

  return (
    <section id="demo" className="relative px-8 py-36">
      <div className="mx-auto w-full max-w-[90rem]">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Live demo</span>
          <h2 className="mt-5 text-4xl tracking-[-0.02em] text-(--ink-primary) sm:text-5xl font-[550]">
            Watch it actually happen.
          </h2>
          <p className="mt-5 text-balance text-lg text-(--ink-secondary)">
            Pick a prompt below. What you see on the right is real FormL, compiled by the real WASM binary, in real
            time — the same pipeline that runs inside the editor.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePromptClick(i)}
              className={`rounded-(--radius-pill) border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                i === activeIdx
                  ? "border-(--accent-primary) bg-(--accent-primary-tint) text-(--accent-primary)"
                  : "border-(--border-hairline) bg-transparent text-(--ink-secondary) hover:border-(--border-hairline-strong) hover:text-(--ink-primary)"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 rounded-(--radius-lg) border border-(--border-hairline) bg-(--bg-surface) px-6 py-5 shadow-md"
            >
              <span className="gradient-accent flex h-9 w-9 flex-none items-center justify-center rounded-full">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <p className="text-base text-(--ink-primary) font-medium">&ldquo;{prompt}&rdquo;</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          ref={demoRef}
          className={`relative mt-10 transition-all duration-600 ease-out ${
            demoVisible ? "scroll-fade-in visible" : "scroll-fade-in"
          }`}
        >
          <MacbookFrame>
            <div className="grid h-[620px] grid-rows-2 lg:h-[760px] lg:grid-cols-2 lg:grid-rows-none">
              <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-(--border-hairline)">
                <div className="flex flex-none items-center justify-between border-b border-(--border-hairline) bg-(--bg-subtle) px-5 py-3">
                  <span className="text-xs tracking-[0.03em] text-(--ink-tertiary) uppercase font-medium">Generated FormL</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-(--accent-primary) font-medium">
                    <span className="h-2 w-2 rounded-full bg-(--accent-primary)" />
                    {compileResult?.ok ? `compiled in ${compileResult.durationMs}ms` : "compiling…"}
                  </span>
                </div>
                <div ref={codeAreaRef} className="relative min-h-0 flex-1 overflow-hidden bg-(--bg-base)">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeIdx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="pt-4"
                    >
                      <CodeBlock
                        code={displayCode}
                        language="forml"
                        hideHeader
                        showLineNumbers={false}
                        bare
                        lineHeight={codeLayout.lineHeight}
                        fontSize={codeFontSize}
                      />
                    </motion.div>
                  </AnimatePresence>

                  {codeLayout.hiddenLines > 0 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-(--bg-base) via-(--bg-base)/70 to-transparent pb-2">
                      <span className="rounded-full border border-(--border-hairline) bg-(--bg-subtle)/90 px-2.5 py-1 font-mono text-[10px] text-(--ink-tertiary)">
                        +{codeLayout.hiddenLines} more {codeLayout.hiddenLines === 1 ? "line" : "lines"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col p-6">
                <div className="mb-4 flex flex-none items-center justify-between">
                  <span className="text-xs tracking-[0.03em] text-(--ink-tertiary) uppercase font-medium">Live Preview</span>
                  {fieldCount > 0 && (
                    <span className="rounded-(--radius-pill) bg-(--bg-subtle) px-2.5 py-1 text-xs text-(--ink-tertiary) font-medium">
                      {fieldCount} field{fieldCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {!ready ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-(--ink-secondary)">
                    <Loader2 className="h-6 w-6 animate-spin text-(--accent-primary)" />
                    <span className="text-sm font-medium">Booting WASM compiler…</span>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeIdx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-5 pb-2"
                      >
                        <RenderStatements
                          stmts={statements}
                          values={formValues}
                          onChange={(key, val) => setFormValues((prev) => ({ ...prev, [key]: val }))}
                        />
                        <button
                          type="button"
                          disabled
                          title="This is a preview — publish a real form in the editor to accept submissions"
                          className="w-full cursor-not-allowed rounded-(--radius-md) bg-(--accent-primary)/40 py-3.5 text-base font-semibold text-white/70"
                        >
                          Submit (live in editor)
                        </button>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </MacbookFrame>
        </div>
      </div>
    </section>
  );
}
