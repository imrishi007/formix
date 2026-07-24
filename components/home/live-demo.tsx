"use client";

/**
 * components/home/live-demo.tsx
 * The real thing, not a mockup: picking a prompt runs it through the same
 * lib/ai-engine.ts generator the workspace's AI panel uses, compiles the
 * resulting FormL with the actual WASM compiler (lib/use-forml-compiler.ts),
 * and renders the result with the same components/form-renderer used
 * everywhere else in the app. Nothing on this page is faked.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { CodeBlock } from "@/components/docs/code-block";
import { RenderStatements, type ASTNode } from "@/components/form-renderer";
import { generateForm, SUGGESTED_PROMPTS } from "@/lib/ai-engine";
import { useFormlCompiler } from "@/lib/use-forml-compiler";

const CYCLE_MS = 7000;

export function LiveDemo() {
  const { ready, compile } = useFormlCompiler();
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

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

  useEffect(() => setFormValues({}), [activeIdx]);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => setActiveIdx((i) => (i + 1) % SUGGESTED_PROMPTS.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [autoCycle]);

  return (
    <section id="demo" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Live demo</span>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Watch it actually happen.
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Pick a prompt below. What you see on the right is real FormL, compiled by the real WASM binary, in real
            time — the same pipeline that runs inside the editor.
          </p>
        </div>

        {/* Prompt chips */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setAutoCycle(false);
                setActiveIdx(i);
              }}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] transition-all duration-300 ${
                i === activeIdx
                  ? "border-accent/40 bg-accent/15 text-foreground"
                  : "border-white/10 bg-transparent text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Active prompt bubble */}
        <div className="mx-auto mt-8 max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-4"
            >
              <span className="gradient-accent flex h-8 w-8 flex-none items-center justify-center rounded-full">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </span>
              <p className="font-inter text-sm text-foreground/90">&ldquo;{prompt}&rdquo;</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* FormL + Live preview — fixed, identical height; each panel scrolls
         *  internally so long generated code/forms never grow the page. */}
        <div className="relative mt-6 grid h-[560px] gap-5 lg:grid-cols-2">
          <div className="flow-comet-vertical h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(124,58,237,0.6)] lg:hidden" style={{ animationDuration: "3s" }} />

          <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
            <div className="flex flex-none items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Generated FormL</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {compileResult?.ok ? `compiled in ${compileResult.durationMs}ms` : "compiling…"}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <CodeBlock code={aiResult.formlCode ?? ""} language="forml" hideHeader showLineNumbers={false} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="glass-card flex h-full min-h-0 flex-col rounded-2xl p-6 md:p-8">
            <div className="mb-6 flex flex-none items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Live Preview</span>
              {fieldCount > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {fieldCount} field{fieldCount === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {!ready ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="font-mono text-xs">Booting WASM compiler…</span>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-5 pb-1"
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
                      className="w-full cursor-not-allowed rounded-lg bg-accent/40 py-3 font-inter text-sm font-semibold text-white/70"
                    >
                      Submit (live in editor)
                    </button>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
