"use client";

import { useEffect, useState, memo } from "react";
import Link from "next/link";

// ─── Self-Contained CSS Keyframes for High-Performance GPU animations ────────

const animationStyles = `
/* Reveal animations for editor lines */
@keyframes reveal-line-1 {
  0% { clip-path: inset(0 100% 0 0); opacity: 0; transform: translateY(4px); }
  2% { opacity: 1; transform: translateY(0); }
  8%, 90% { clip-path: inset(0 0 0 0); opacity: 1; transform: translateY(0); }
  93%, 100% { clip-path: inset(0 0 0 0); opacity: 0; transform: translateY(-4px); }
}
@keyframes reveal-line-2 {
  0%, 10% { clip-path: inset(0 100% 0 0); opacity: 0; transform: translateY(4px); }
  12% { opacity: 1; transform: translateY(0); }
  18%, 90% { clip-path: inset(0 0 0 0); opacity: 1; transform: translateY(0); }
  93%, 100% { clip-path: inset(0 0 0 0); opacity: 0; transform: translateY(-4px); }
}
@keyframes reveal-line-3 {
  0%, 20% { clip-path: inset(0 100% 0 0); opacity: 0; transform: translateY(4px); }
  22% { opacity: 1; transform: translateY(0); }
  28%, 90% { clip-path: inset(0 0 0 0); opacity: 1; transform: translateY(0); }
  93%, 100% { clip-path: inset(0 0 0 0); opacity: 0; transform: translateY(-4px); }
}
@keyframes reveal-line-4 {
  0%, 30% { clip-path: inset(0 100% 0 0); opacity: 0; transform: translateY(4px); }
  32% { opacity: 1; transform: translateY(0); }
  38%, 90% { clip-path: inset(0 0 0 0); opacity: 1; transform: translateY(0); }
  93%, 100% { clip-path: inset(0 0 0 0); opacity: 0; transform: translateY(-4px); }
}

/* Cursor blink */
@keyframes cursor-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* Cursor visibility sync windows */
@keyframes cursor-vis-1 {
  0%, 10% { opacity: 1; }
  10.01%, 100% { opacity: 0; }
}
@keyframes cursor-vis-2 {
  0%, 10% { opacity: 0; }
  10.01%, 20% { opacity: 1; }
  20.01%, 100% { opacity: 0; }
}
@keyframes cursor-vis-3 {
  0%, 20% { opacity: 0; }
  20.01%, 30% { opacity: 1; }
  30.01%, 100% { opacity: 0; }
}
@keyframes cursor-vis-4 {
  0%, 30% { opacity: 0; }
  30.01%, 40% { opacity: 1; }
  40.01%, 100% { opacity: 0; }
}

/* Compiler status timeline */
@keyframes status-text-waiting {
  0%, 40% { opacity: 1; }
  40.01%, 100% { opacity: 0; }
}
@keyframes status-text-parsing {
  0%, 40% { opacity: 0; }
  40.01%, 52.5% { opacity: 1; }
  52.51%, 100% { opacity: 0; }
}
@keyframes status-text-built {
  0%, 52.5% { opacity: 0; }
  52.51%, 65% { opacity: 1; }
  65.01%, 100% { opacity: 0; }
}
@keyframes status-text-ready {
  0%, 65% { opacity: 0; }
  65.01%, 90% { opacity: 1; }
  90.01%, 100% { opacity: 0; }
}

/* AST tree nodes highlight sequence */
@keyframes ast-node-1 {
  0%, 52.5% { opacity: 0.2; transform: scale(0.98) translateY(2px); }
  52.51%, 90% { opacity: 1; transform: scale(1) translateY(0); }
  90.01%, 100% { opacity: 0.2; transform: scale(0.98) translateY(-2px); }
}
@keyframes ast-node-2 {
  0%, 56.5% { opacity: 0.2; transform: scale(0.98) translateY(2px); }
  56.51%, 90% { opacity: 1; transform: scale(1) translateY(0); }
  90.01%, 100% { opacity: 0.2; transform: scale(0.98) translateY(-2px); }
}
@keyframes ast-node-3 {
  0%, 60.5% { opacity: 0.2; transform: scale(0.98) translateY(2px); }
  60.51%, 90% { opacity: 1; transform: scale(1) translateY(0); }
  90.01%, 100% { opacity: 0.2; transform: scale(0.98) translateY(-2px); }
}
@keyframes ast-node-4 {
  0%, 64.5% { opacity: 0.2; transform: scale(0.98) translateY(2px); }
  64.51%, 90% { opacity: 1; transform: scale(1) translateY(0); }
  90.01%, 100% { opacity: 0.2; transform: scale(0.98) translateY(-2px); }
}

/* Status dot amber pulsing during compile */
@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

// ─── Memoized Static Background Grid ──────────────────────────────────────────

const BlueprintGrid = memo(function BlueprintGrid() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      {/* 4% grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-4"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Major blueprint grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-3"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "160px 160px",
        }}
      />
      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />
    </>
  );
});

// ─── Memoized Editor & Status Panel (Runs completely in CSS/GPU) ──────────────────

const EditorPanel = memo(function EditorPanel({ filename }: { filename: string }) {
  return (
    <div className="w-full max-w-[560px] flex flex-col justify-center">
      {/* Miniature editor window */}
      <div
        className="rounded-xl overflow-hidden backdrop-blur-md relative"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
          boxShadow: "0 40px 80px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Realistic Window Chrome */}
        <div
          className="flex items-center gap-2 px-5 py-3.5 select-none relative"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="font-mono text-[10px] tracking-wide text-white/20 select-none">
              {filename}
            </span>
          </div>
          <div className="flex-1" />
          <div className="w-1 h-1 rounded-full bg-white/10" />
        </div>

        {/* Code area - Monochrome syntax styling */}
        <div className="px-6 py-6 min-h-[220px] font-mono text-[12px] leading-[1.85] select-none space-y-0.5">
          {/* Line 1 */}
          <div className="flex items-start" style={{ animation: "reveal-line-1 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-white/15 select-none text-right pr-4">1</span>
            <span className="text-white/80">
              <span className="text-white/90">form</span> <span className="text-white/50">"Signup"</span> <span className="text-white/30">{"{"}</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 bg-green-400 ml-0.5 mt-0.5 align-middle"
              style={{ animation: "cursor-blink 0.5s infinite step-end, cursor-vis-1 8s infinite step-end" }}
            />
          </div>

          {/* Line 2 */}
          <div className="flex items-start" style={{ animation: "reveal-line-2 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-white/15 select-none text-right pr-4">2</span>
            <span className="text-white/80">
              <span className="text-white/30">&nbsp;&nbsp;</span>
              <span className="text-white/90">field</span> email : <span className="text-white/60">email</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 bg-green-400 ml-0.5 mt-0.5 align-middle"
              style={{ animation: "cursor-blink 0.5s infinite step-end, cursor-vis-2 8s infinite step-end" }}
            />
          </div>

          {/* Line 3 */}
          <div className="flex items-start" style={{ animation: "reveal-line-3 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-white/15 select-none text-right pr-4">3</span>
            <span className="text-white/80">
              <span className="text-white/30">&nbsp;&nbsp;</span>
              <span className="text-white/90">field</span> password : <span className="text-white/60">text</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 bg-green-400 ml-0.5 mt-0.5 align-middle"
              style={{ animation: "cursor-blink 0.5s infinite step-end, cursor-vis-3 8s infinite step-end" }}
            />
          </div>

          {/* Line 4 */}
          <div className="flex items-start" style={{ animation: "reveal-line-4 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-white/15 select-none text-right pr-4">4</span>
            <span className="text-white/80">
              <span className="text-white/30">{"}"}</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 bg-green-400 ml-0.5 mt-0.5 align-middle"
              style={{ animation: "cursor-blink 0.5s infinite step-end, cursor-vis-4 8s infinite step-end" }}
            />
          </div>
        </div>

        {/* Dynamic Compiler status bar */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-t select-none h-[42px] relative overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {/* Waiting */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-waiting 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white/15" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/20">WASM · Waiting for input…</span>
          </div>

          {/* Parsing */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-parsing 8s infinite step-end" }}>
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400/90"
              style={{
                boxShadow: "0 0 6px rgba(251,191,36,0.6)",
                animation: "statusPulse 0.6s step-end infinite",
              }}
            />
            <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400/80">WASM · Parsing AST…</span>
          </div>

          {/* AST Built */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-built 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.7)" }} />
            <span className="font-mono text-[9px] uppercase tracking-wider text-green-400/80">WASM · AST Built</span>
            <span className="ml-auto font-mono text-[9px] text-green-400/50">2ms</span>
          </div>

          {/* Render Ready */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-ready 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.7)" }} />
            <span className="font-mono text-[9px] uppercase tracking-wider text-green-400/80">WASM · Render Ready</span>
            <span className="ml-auto font-mono text-[9px] text-green-400/50">4ms</span>
          </div>
        </div>
      </div>

      {/* AST Mini Visualization */}
      <div className="mt-8 flex items-start gap-3 select-none">
        <div className="flex flex-col items-center gap-0 pt-0.5">
          <div className="w-px h-14 bg-white/10" />
        </div>
        <div className="font-mono text-[10px] space-y-[4px] leading-relaxed">
          {/* Node 1 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-1 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full bg-green-400" style={{ boxShadow: "0 0 4px rgba(74,222,128,0.8)" }} />
            <span className="text-white/60">Form: Signup</span>
          </div>
          {/* Node 2 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-2 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full bg-green-400" style={{ boxShadow: "0 0 4px rgba(74,222,128,0.8)" }} />
            <span className="text-white/60">Field: email (Type: email)</span>
          </div>
          {/* Node 3 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-3 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full bg-green-400" style={{ boxShadow: "0 0 4px rgba(74,222,128,0.8)" }} />
            <span className="text-white/60">Field: password (Type: text)</span>
          </div>
          {/* Node 4 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-4 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full bg-green-400" style={{ boxShadow: "0 0 4px rgba(74,222,128,0.8)" }} />
            <span className="text-white/60">Action: submit</span>
          </div>
        </div>
      </div>

      {/* Subdued blueprint text */}
      <div className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-widest text-white/20">
          Every form begins as text.
        </p>
      </div>
    </div>
  );
});

// ─── Main Layout ──────────────────────────────────────────────────────────────

interface AuthLayoutProps {
  children: React.ReactNode;
  mode: "signin" | "signup";
}

export function AuthLayout({ children, mode }: AuthLayoutProps) {
  const filename = mode === "signin" ? "signin.forml" : "signup.forml";

  return (
    <div className="min-h-screen flex" style={{ background: "#0B0B0B" }}>

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — 40% — Visual Centerpiece
      ══════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[40%] shrink-0 relative overflow-hidden"
        style={{ background: "#0B0B0B", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <BlueprintGrid />

        {/* Technical Corner Accents */}
        <div className="absolute top-0 left-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute top-6 left-6 w-4 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute top-6 left-6 w-px h-4" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div className="absolute top-0 right-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute top-6 right-6 w-4 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute top-6 right-6 w-px h-4" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div className="absolute bottom-0 left-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute bottom-6 left-6 w-4 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute bottom-6 left-6 w-px h-4" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>
        <div className="absolute bottom-0 right-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute bottom-6 right-6 w-4 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute bottom-6 right-6 w-px h-4" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Left Side Content */}
        <div className="relative z-10 flex flex-col h-full px-12 xl:px-14 py-12 justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <span className="font-display text-2xl tracking-tight transition-opacity duration-150 group-hover:opacity-75 text-white/90">
              Formix
            </span>
            <span className="font-mono text-[11px] mt-1 transition-opacity duration-150 group-hover:opacity-50 text-white/30">
              .forml
            </span>
          </Link>

          {/* Visual Centerpiece (Editor) */}
          <div className="flex-1 flex items-center justify-center">
            <EditorPanel filename={filename} />
          </div>

          {/* bottom pipeline steps */}
          <div
            className="pt-8 border-t space-y-3"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {[
              { label: "Hand-written C++ compiler", step: "01" },
              { label: "Compiled to WebAssembly", step: "02" },
              { label: "Runs entirely in your browser", step: "03" },
            ].map(({ label, step }, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="font-mono text-[9px] w-6 text-right text-white/15">
                  {step}
                </span>
                <span className="font-mono text-[10px] text-white/35">
                  {label}
                </span>
                {i < 2 && (
                  <span className="ml-auto font-mono text-[9px] text-white/10">
                    ↓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — 60% — Premium Authentication UX
      ══════════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col min-h-screen relative"
        style={{ background: "#F8F6F2" }}
      >
        {/* Micro coordinate dots */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.25]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(11,11,11,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Mobile Header */}
        <div className="lg:hidden relative z-10 flex items-center justify-between px-8 pt-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-tight text-[#0B0B0B]">
              Formix
            </span>
            <span className="font-mono text-[11px] mt-1 text-[#0B0B0B]/40">
              .forml
            </span>
          </Link>
        </div>

        {/* Centered Auth Card Area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-10 sm:px-16 py-20">
          <div className="w-full max-w-[400px]">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div
          className="relative z-10 px-12 py-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(11,11,11,0.06)" }}
        >
          <p className="font-mono text-[10px] text-[#0B0B0B]/30">
            © 2026 Formix
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="font-mono text-[10px] text-[#0B0B0B]/35 transition-opacity duration-150 hover:opacity-100"
            >
              Docs
            </Link>
            <Link
              href="#"
              className="font-mono text-[10px] text-[#0B0B0B]/35 transition-opacity duration-150 hover:opacity-100"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="font-mono text-[10px] text-[#0B0B0B]/35 transition-opacity duration-150 hover:opacity-100"
            >
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
