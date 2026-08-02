"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// ─── Pointer parallax hook ────────────────────────────────────────────────────
// Tracks pointer position relative to the element's own center, translates
// it into a small X/Y offset that makes the copy block feel like it has depth.
// Applied ONLY on hover — pointer-driven, never scroll-driven. (design.md §Depth)
function usePointerParallax(strength = 8) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      // Normalised pointer position in [-0.5, 0.5]
      const nx = (e.clientX - left - width / 2) / width;
      const ny = (e.clientY - top - height / 2) / height;
      // Apply as a subtle translate — not a rotate, not a 3D scene
      el.style.transform = `translate(${nx * strength}px, ${ny * strength}px)`;
    },
    [strength],
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Settle smoothly back to center (150ms ease-out per design.md Motion)
    el.style.transition = "transform 200ms ease-out";
    el.style.transform = "translate(0px, 0px)";
    // Clear inline transition so normal CSS picks up after
    setTimeout(() => {
      if (el) el.style.transition = "";
    }, 200);
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

export function Hero() {
  // Content is visible immediately on load — no mount fade, no translate-in.
  // design.md Motion: "No scroll-triggered animations of any kind. Content is
  // visible immediately on load/navigation."
  const parallax = usePointerParallax(6);

  return (
    <section
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-(--bg-base) px-8 pt-36 pb-28"
    >
      {/* Dot grid — very faint, gives the page subtle texture without competing */}
      <div className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">

        {/* ── Eyebrow pill — status chip, pill radius is correct here (badge) ── */}
        <div className="mb-10 flex items-center gap-2.5 rounded-(--radius-pill) border border-(--border-hairline) bg-(--bg-surface) px-5 py-2 shadow-(--shadow-sm)">
          {/* Amber dot — uses accent-secondary (warm amber) as the "live" indicator */}
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--accent-secondary) opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-(--accent-secondary)" />
          </span>
          <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-(--ink-tertiary)">
            AI-native forms, compiled
          </span>
        </div>

        {/* ── Headline — pointer-parallax on the copy block ─────────────── */}
        {/* The outer div is the parallax receiver; the inner content has
            pointer events so it doesn't eat child interactions. */}
        <div
          {...parallax}
          style={{ willChange: "transform" }}
          className="flex flex-col items-center"
        >
          <h1 className="text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.05] tracking-[-0.02em] text-(--ink-primary)">
            <span className="block font-[550]">From a sentence</span>
            <span className="block font-[550]">
              to a{" "}
              {/* accent-primary on the brand phrase — one instance per page */}
              <span className="text-(--accent-primary)">running form</span>.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-balance text-xl leading-relaxed text-(--ink-secondary)">
            Describe what you need. Formix AI writes it in{" "}
            <strong className="font-semibold text-(--ink-primary)">FormL</strong> — a real
            language, parsed by a hand-written C++ compiler running as WebAssembly, right in
            your browser.
          </p>

          {/* ── CTAs — radius-md (14px), colored shadow, scale on hover ── */}
          {/* Primary gets the gradient fill (one hero CTA per page max,
              per design.md gradient rule). Secondary is outline. */}
          <div className="mt-12 flex flex-col items-center gap-5 sm:flex-row">
            {/* Primary CTA — btn-primary-gradient: the one hero gradient per
                page (design.md rule), --accent-gradient (blue-500→400 light,
                blue-400→300 dark), --shadow-btn-primary growing on hover,
                text --on-accent (white in both themes). No hardcoded hex —
                all tokenized. */}
            <Link
              href="/editor/demo?ai=1"
              id="hero-cta-primary"
              className="group inline-flex items-center gap-3 rounded-(--radius-md) px-8 py-4 text-lg font-semibold btn-primary-gradient"
            >
              Talk to Formix AI
              <ArrowRight className="size-5 transition-transform duration-150 group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA — outline, radius-md matches primary */}
            <Link
              href="/editor/demo"
              id="hero-cta-secondary"
              className="inline-flex items-center rounded-(--radius-md) border border-(--border-hairline-strong) bg-transparent px-8 py-4 text-lg font-semibold text-(--ink-primary) transition-all duration-150 hover:bg-(--bg-subtle) active:scale-[0.98]"
            >
              Open the Editor
            </Link>
          </div>
        </div>

        {/* ── Sub-caption — compiler stack proof-point ─────────────────── */}
        <div className="mt-12 flex items-center gap-3">
          <span className="font-mono text-xs text-(--ink-tertiary) opacity-60">
            hand-written C++ parser · compiled to WebAssembly · runs in your browser
          </span>
        </div>
      </div>
    </section>
  );
}
