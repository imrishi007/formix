"use client";

import { motion } from "framer-motion";
import { Eye, GitBranch, Layers, Sparkles, Terminal, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Terminal,
    title: "A real compiler, not a parser hack",
    desc: "FormL is lexed, parsed, and semantically analyzed by a hand-written C++ compiler — the same kind of pipeline a real programming language gets.",
    accent: "--accent-primary",
  },
  {
    icon: Zap,
    title: "Zero network latency",
    desc: "That compiler ships to your browser as WebAssembly. Every keystroke compiles locally, in milliseconds — nothing round-trips to a server.",
    accent: "--accent-secondary",
  },
  {
    icon: Sparkles,
    title: "AI that writes FormL, not JSON",
    desc: "Formix AI drafts, explains, fixes, and improves your form in the actual DSL — so what it writes is exactly what you could have typed yourself.",
    accent: "--accent-primary",
  },
  {
    icon: GitBranch,
    title: "Forms as code, for real",
    desc: "One .forml file is one form. Commit it, diff it, review it in a pull request — your form's history lives in Git, not a hidden database blob.",
    accent: "--accent-secondary",
  },
  {
    icon: Layers,
    title: "A grammar with real depth",
    desc: "Conditionals, repeat groups, computed fields, multi-page flows, dynamic options — not a toy schema, the full shape of a real form.",
    accent: "--accent-primary",
  },
  {
    icon: Eye,
    title: "See it render as you write it",
    desc: "The live preview isn't a screenshot — it's the same renderer that powers published forms, updating on every compile.",
    accent: "--accent-secondary",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="relative bg-(--bg-subtle) px-8 py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Why Formix</span>
          <h2 className="mt-5 text-4xl tracking-[-0.02em] text-(--ink-primary) sm:text-5xl font-[550]">
            Built like a language.
            <br />
            Used like a conversation.
          </h2>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="card-base p-7"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-(--radius-md)"
                style={{ backgroundColor: `color-mix(in srgb, var(${f.accent}) 12%, transparent)` }}
              >
                <f.icon className="h-6 w-6" style={{ color: `var(${f.accent})` }} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-(--ink-primary)">{f.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-(--ink-secondary)">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
