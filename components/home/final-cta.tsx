"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-tint-amber bg-form-outline px-8 py-36">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <span className="mb-10 flex items-center gap-3 rounded-(--radius-pill) border border-(--border-hairline) bg-(--bg-surface) px-5 py-2 shadow-md">
          <Sparkles className="h-4 w-4 text-(--accent-primary)" />
          <span className="text-xs tracking-[0.03em] text-(--ink-tertiary) uppercase font-medium">Start building</span>
        </span>

        <h2 className="text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.02em] text-(--ink-primary) font-[550]">
          Your next form
          <br />
          is <span className="text-(--accent-primary)">one sentence away</span>.
        </h2>

        <p className="mt-6 max-w-xl text-balance text-lg text-(--ink-secondary)">
          No drag-and-drop canvas. No JSON schema to hand-edit. Just describe the form, and watch Formix compile it.
        </p>

        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row">
          <Button asChild size="lg" className="group h-16 gap-3 rounded-(--radius-pill) px-10 text-lg">
            <Link href="/editor/demo?ai=1">
              Talk to Formix AI
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-16 rounded-(--radius-pill) px-10 text-lg">
            <Link href="/editor/demo">Open the Editor</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
