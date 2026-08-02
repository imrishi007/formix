"use client";

import { motion } from "framer-motion";
import { Cpu, FileCode2, MessageSquareText, MonitorCheck, Sparkles, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STAGES = [
  { icon: MessageSquareText, label: "Natural Language", desc: "\"A feedback form with a rating\"", accent: "--accent-primary" },
  { icon: Sparkles, label: "Formix AI", desc: "Interprets intent, drafts structure", accent: "--accent-secondary" },
  { icon: FileCode2, label: "FormL", desc: "A real, readable DSL — not JSON", accent: "--accent-primary" },
  { icon: Cpu, label: "WASM Compiler", desc: "Hand-written C++, runs in-browser", accent: "--accent-secondary" },
  { icon: Workflow, label: "AST", desc: "Typed JSON tree, zero network calls", accent: "--accent-primary" },
  { icon: MonitorCheck, label: "Live Form", desc: "Rendered, validated, ready to ship", accent: "--accent-secondary" },
] as const;

export function Pipeline() {
  const [pathD, setPathD] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const computePath = () => {
      const sectionRect = section.getBoundingClientRect();
      const centers = cardRefs.current
        .filter((c): c is HTMLDivElement => c !== null)
        .map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2 - sectionRect.left,
            y: rect.top + rect.height / 2 - sectionRect.top,
          };
        });

      if (centers.length < 2) return;

      let d = `M ${centers[0].x} ${centers[0].y}`;
      for (let i = 1; i < centers.length; i++) {
        const prev = centers[i - 1];
        const curr = centers[i];
        const cx = (prev.x + curr.x) / 2;
        d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      setPathD(d);
    };

    computePath();
    window.addEventListener("resize", computePath);
    return () => window.removeEventListener("resize", computePath);
  }, []);

  return (
    <section
      id="pipeline"
      ref={sectionRef}
      className="relative overflow-hidden bg-tint-accent bg-compile-pattern px-8 py-36"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">How it works</span>
          <h2 className="mt-5 text-4xl tracking-[-0.02em] text-(--ink-primary) sm:text-5xl font-[550]">
            One pipeline, start to finish.
          </h2>
          <p className="mt-5 text-balance text-lg text-(--ink-secondary)">
            Nothing here is a diagram for its own sake — this is the literal path your words take, from the chat
            panel to a rendered field on screen.
          </p>
        </div>

        <div className="relative mt-24">
          {pathD && (
            <svg
              className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
              style={{ overflow: "visible" }}
            >
              <motion.path
                d={pathD}
                stroke="var(--accent-primary)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={isVisible ? { pathLength: 1, opacity: 0.4 } : {}}
                transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
          )}

          <div className="relative z-10 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {STAGES.map((stage, i) => (
              <motion.div
                key={stage.label}
                ref={(el) => { cardRefs.current[i] = el; }}
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.6,
                  delay: 0.15 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="card-base relative flex flex-col gap-4 px-6 py-8"
              >
                <div className="absolute left-4 top-4">
                  <span className="badge-step">{String(i + 1).padStart(2, "0")}</span>
                </div>

                <span
                  className="mt-6 flex h-14 w-14 flex-none items-center justify-center rounded-(--radius-md)"
                  style={{ backgroundColor: `color-mix(in srgb, var(${stage.accent}) 12%, transparent)` }}
                >
                  <stage.icon className="size-7" style={{ color: `var(${stage.accent})` }} />
                </span>

                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-(--ink-primary)">{stage.label}</span>
                  <span className="text-sm leading-snug text-(--ink-tertiary)">{stage.desc}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
