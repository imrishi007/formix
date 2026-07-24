"use client";

/**
 * components/home/features.tsx
 * "Why Formix" — brand-new animated feature-card grid.
 */

import { motion } from "framer-motion";
import { Eye, GitBranch, Layers, Sparkles, Terminal, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Terminal,
    title: "A real compiler, not a parser hack",
    desc: "FormL is lexed, parsed, and semantically analyzed by a hand-written C++ compiler — the same kind of pipeline a real programming language gets.",
  },
  {
    icon: Zap,
    title: "Zero network latency",
    desc: "That compiler ships to your browser as WebAssembly. Every keystroke compiles locally, in milliseconds — nothing round-trips to a server.",
  },
  {
    icon: Sparkles,
    title: "AI that writes FormL, not JSON",
    desc: "Formix AI drafts, explains, fixes, and improves your form in the actual DSL — so what it writes is exactly what you could have typed yourself.",
  },
  {
    icon: GitBranch,
    title: "Forms as code, for real",
    desc: "One .forml file is one form. Commit it, diff it, review it in a pull request — your form's history lives in Git, not a hidden database blob.",
  },
  {
    icon: Layers,
    title: "A grammar with real depth",
    desc: "Conditionals, repeat groups, computed fields, multi-page flows, dynamic options — not a toy schema, the full shape of a real form.",
  },
  {
    icon: Eye,
    title: "See it render as you write it",
    desc: "The live preview isn't a screenshot — it's the same renderer that powers published forms, updating on every compile.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Why Formix</span>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Built like a language.
            <br />
            Used like a conversation.
          </h2>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="card-spotlight glass-card hover-lift rounded-2xl p-7"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
              }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
                <f.icon className="h-5 w-5 text-accent" />
              </span>
              <h3 className="mt-5 font-inter text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
