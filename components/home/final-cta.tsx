"use client";

/**
 * components/home/final-cta.tsx
 * Closing moment — same destinations as the hero's CTAs, deliberately
 * echoed here rather than introducing new ones. Stays on the same dark
 * canvas as the rest of the page — no inverted light panel.
 */

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      <div className="blob-drift absolute left-1/2 top-1/2 -z-10 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c3aed]/15 blur-[150px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <span className="glass-panel mb-8 flex items-center gap-2 rounded-full px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Start building</span>
        </span>

        <h2 className="font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02] tracking-tight text-foreground">
          Your next form
          <br />
          <span className="text-gradient-accent">is one sentence away.</span>
        </h2>

        <p className="mt-6 max-w-lg text-balance text-muted-foreground">
          No drag-and-drop canvas. No JSON schema to hand-edit. Just describe the form, and watch Formix compile it.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="group h-14 gap-2 rounded-full px-8 text-base">
            <Link href="/editor/demo?ai=1">
              Talk to Formix AI
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-8 text-base">
            <Link href="/editor/demo">Open the Editor</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
