"use client";

/**
 * components/home/hero.tsx
 * Brand-new hero for the rebuilt homepage. Same destinations as the old
 * hero (/editor/demo?ai=1, /editor/demo). Kept deliberately clean — no
 * floating decorative keywords — just the headline, copy, and CTAs on the
 * same dark graphite canvas as the rest of the page.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(true), []);

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 pt-32 pb-24">
      {/* Ambient background — same dark canvas throughout, just depth cues */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-dot-grid absolute inset-0 opacity-40" />
        <div className="blob-drift absolute left-1/2 top-1/4 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#7c3aed]/20 blur-[140px]" />
        <div className="blob-drift-slow absolute bottom-0 right-1/4 h-[420px] w-[420px] rounded-full bg-[#3b82f6]/20 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <div
          className={`glass-panel mb-8 flex items-center gap-2 rounded-full px-4 py-1.5 transition-all duration-700 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            AI-native forms, compiled
          </span>
        </div>

        <h1
          className={`font-display text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.98] tracking-tight text-foreground transition-all duration-700 delay-100 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="block">From a sentence</span>
          <span className="text-gradient-accent block">to a running form.</span>
        </h1>

        <p
          className={`mt-8 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground transition-all duration-700 delay-200 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          Describe what you need. Formix AI writes it in <strong className="font-semibold text-foreground">FormL</strong> — a real
          language, parsed by a hand-written C++ compiler running as WebAssembly, right in your browser.
        </p>

        <div
          className={`mt-10 flex flex-col items-center gap-4 transition-all duration-700 delay-300 sm:flex-row ${
            visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
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

        <div
          className={`mt-10 flex items-center gap-2 transition-all delay-500 duration-700 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Compiler running live in your browser — zero network latency
          </span>
        </div>
      </div>
    </section>
  );
}
