"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ASTVisualizer } from "./ast-visualizer";

const statusItems = [
  "v1.1 GRAMMAR",
  "100% CLIENT-SIDE WASM",
  "0 NETWORK LATENCY",
  "HAND-WRITTEN PARSER",
  "JSON AST OUTPUT",
];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40 w-full">

        {/* Two-column grid: copy left, visualizer right */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* ── Left: Text content ── */}
          <div>
            {/* Eyebrow */}
            <div
              className={`mb-8 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
                <span className="w-8 h-px bg-foreground/30" />
                Forms as Code
              </span>
            </div>

            {/* Main headline */}
            <div className="mb-10">
              <h1 className="text-[clamp(2.8rem,8vw,7rem)] font-display leading-[0.9] tracking-tight text-[#080503] opacity-100 blur-none select-text bg-none bg-transparent !text-[#080503]">
                <span className="block text-[#080503] opacity-100 blur-none">Forms that live</span>
                <span className="block text-[#080503] opacity-100 blur-none">in code</span>
              </h1>
            </div>

            {/* Description */}
            <p
              className={`text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-md mb-10 transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Define your forms in a custom DSL. Version-control them in Git.
              Render live interactive UIs — no drag-and-drop, no JSON configs.
            </p>

            {/* CTAs */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Button asChild size="lg" className="bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group">
                <Link href="/editor/demo">
                  Talk to AI
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5">
                <Link href="/editor/demo">Open Editor</Link>
              </Button>
            </div>

            {/* Mono caption below CTAs */}
            <p
              className={`mt-8 font-mono text-xs text-muted-foreground/60 transition-all duration-700 delay-400 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              hand-written C++ parser · compiled to WebAssembly · runs in your browser
            </p>
          </div>

          {/* ── Right: AST Visualizer ── */}
          <div
            className={`hidden lg:block transition-all duration-1000 delay-500 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <ASTVisualizer />
          </div>
        </div>
      </div>

      {/* Static system diagnostic bar - full width, bottom of section */}
      <div
        className={`absolute bottom-16 left-0 right-0 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-5 border-y border-[#080503]/20 bg-background/80 backdrop-blur-sm">
          {statusItems.map((item) => (
            <div
              key={item}
              className="min-h-12 border-b border-[#080503]/20 px-4 py-3 sm:border-b-0 sm:border-r sm:last:border-r-0 font-mono text-[10px] uppercase tracking-widest text-foreground/75 flex items-center justify-center text-center"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
