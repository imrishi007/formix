"use client";

/**
 * components/home/pipeline.tsx
 * "AI → Compiler Pipeline" — a brand-new animated node-flow diagram showing
 * the real path a request takes through Formix: Natural Language → Formix
 * AI → FormL → WASM Compiler → AST → Live Form. Purely presentational (the
 * real thing happens in the editor / demo section below), but every stage
 * name matches an actual part of the system, not marketing fluff.
 */

import { motion } from "framer-motion";
import { Cpu, FileCode2, MessageSquareText, MonitorCheck, Sparkles, Workflow } from "lucide-react";

const STAGES = [
  { icon: MessageSquareText, label: "Natural Language", desc: "\"A feedback form with a rating\"" },
  { icon: Sparkles, label: "Formix AI", desc: "Interprets intent, drafts structure" },
  { icon: FileCode2, label: "FormL", desc: "A real, readable DSL — not JSON" },
  { icon: Cpu, label: "WASM Compiler", desc: "Hand-written C++, runs in-browser" },
  { icon: Workflow, label: "AST", desc: "Typed JSON tree, zero network calls" },
  { icon: MonitorCheck, label: "Live Form", desc: "Rendered, validated, ready to ship" },
] as const;

export function Pipeline() {
  return (
    <section id="pipeline" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">How it works</span>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            One pipeline, start to finish.
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Nothing here is a diagram for its own sake — this is the literal path your words take, from the chat
            panel to a rendered field on screen.
          </p>
        </div>

        <div className="relative mt-20">
          <div className="absolute inset-x-8 top-[3.25rem] hidden h-px overflow-visible bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block">
            <span className="flow-comet h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(124,58,237,0.65)]" style={{ animationDuration: "4s" }} />
            <span className="flow-comet h-2 w-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_2px_rgba(59,130,246,0.6)]" style={{ animationDuration: "4s", animationDelay: "2s" }} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
            {STAGES.map((stage, i) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card card-spotlight relative flex flex-col items-center gap-3 rounded-2xl px-4 py-6 text-center"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
                }}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
                  <stage.icon className="h-5 w-5 text-accent" />
                </span>
                <span className="font-inter text-sm font-semibold text-foreground">{stage.label}</span>
                <span className="font-mono text-[11px] leading-snug text-muted-foreground/80">{stage.desc}</span>
                <span className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
