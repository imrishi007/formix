"use client";

import { memo } from "react";
import Link from "next/link";
import { FormixLogo } from "@/components/brand/formix-logo";

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

/* Status dot pulsing during compile */
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
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--border-hairline) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-hairline) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          opacity: 0.5,
        }}
      />
      {/* Major blueprint grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--border-hairline) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-hairline) 1px, transparent 1px)
          `,
          backgroundSize: "160px 160px",
          opacity: 0.7,
        }}
      />
      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />
    </>
  );
});

// ─── Memoized Editor & Status Panel ──────────────────────────────────

const EditorPanel = memo(function EditorPanel({ filename }: { filename: string }) {
  return (
    <div className="w-full max-w-[560px] flex flex-col justify-center">
      {/* Miniature editor window */}
      <div
        className="rounded-xl overflow-hidden relative"
        style={{
          border: "1px solid var(--border-hairline)",
          background: "var(--bg-card)",
          boxShadow: "0 20px 56px -16px rgba(0,0,0,0.12), 0 0 0 1px var(--border-hairline)",
        }}
      >
        {/* Realistic Window Chrome */}
        <div
          className="flex items-center gap-2 px-5 py-3.5 select-none relative"
          style={{
            borderBottom: "1px solid var(--border-hairline)",
            background: "var(--bg-subtle)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-danger)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-secondary)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-success)" }} />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="font-mono text-[10px] tracking-wide text-(--ink-tertiary) select-none">
              {filename}
            </span>
          </div>
          <div className="flex-1" />
          <div className="w-1 h-1 rounded-full" style={{ background: "var(--ink-disabled)" }} />
        </div>

        {/* Code area - Light syntax styling */}
        <div className="px-6 py-6 min-h-[220px] font-mono text-[12px] leading-[1.85] select-none space-y-0.5">
          {/* Line 1 */}
          <div className="flex items-start" style={{ animation: "reveal-line-1 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-(--ink-disabled) select-none text-right pr-4">1</span>
            <span className="text-(--ink-primary)">
              <span style={{ color: "#2563eb" }}>form</span> <span style={{ color: "#b45309" }}>&quot;Signup&quot;</span> <span className="text-(--ink-tertiary)">{"{"}</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 ml-0.5 mt-0.5 align-middle"
              style={{ background: "var(--accent-primary)", animation: "cursor-blink 0.5s infinite step-end, cursor-vis-1 8s infinite step-end" }}
            />
          </div>

          {/* Line 2 */}
          <div className="flex items-start" style={{ animation: "reveal-line-2 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-(--ink-disabled) select-none text-right pr-4">2</span>
            <span className="text-(--ink-primary)">
              <span className="text-(--ink-tertiary)">&nbsp;&nbsp;</span>
              <span style={{ color: "#2563eb" }}>field</span> email : <span style={{ color: "#059669" }}>email</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 ml-0.5 mt-0.5 align-middle"
              style={{ background: "var(--accent-primary)", animation: "cursor-blink 0.5s infinite step-end, cursor-vis-2 8s infinite step-end" }}
            />
          </div>

          {/* Line 3 */}
          <div className="flex items-start" style={{ animation: "reveal-line-3 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-(--ink-disabled) select-none text-right pr-4">3</span>
            <span className="text-(--ink-primary)">
              <span className="text-(--ink-tertiary)">&nbsp;&nbsp;</span>
              <span style={{ color: "#2563eb" }}>field</span> password : <span style={{ color: "#059669" }}>text</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 ml-0.5 mt-0.5 align-middle"
              style={{ background: "var(--accent-primary)", animation: "cursor-blink 0.5s infinite step-end, cursor-vis-3 8s infinite step-end" }}
            />
          </div>

          {/* Line 4 */}
          <div className="flex items-start" style={{ animation: "reveal-line-4 8s infinite ease-out" }}>
            <span className="w-8 shrink-0 text-(--ink-disabled) select-none text-right pr-4">4</span>
            <span className="text-(--ink-primary)">
              <span className="text-(--ink-tertiary)">{"}"}</span>
            </span>
            <span
              className="inline-block w-[1.5px] h-3.5 ml-0.5 mt-0.5 align-middle"
              style={{ background: "var(--accent-primary)", animation: "cursor-blink 0.5s infinite step-end, cursor-vis-4 8s infinite step-end" }}
            />
          </div>
        </div>

        {/* Dynamic Compiler status bar */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-t select-none h-[42px] relative overflow-hidden"
          style={{ borderColor: "var(--border-hairline)" }}
        >
          {/* Waiting */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-waiting 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--ink-disabled)" }} />
            <span className="font-mono text-[9px] uppercase tracking-wider text-(--ink-tertiary)">WASM · Waiting for input…</span>
          </div>

          {/* Parsing */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-parsing 8s infinite step-end" }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "var(--accent-secondary)",
                boxShadow: "0 0 6px color-mix(in srgb, var(--accent-secondary) 60%, transparent)",
                animation: "statusPulse 0.6s step-end infinite",
              }}
            />
            <span style={{ color: "var(--accent-secondary)", opacity: 0.8 }} className="font-mono text-[9px] uppercase tracking-wider">WASM · Parsing AST…</span>
          </div>

          {/* AST Built */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-built 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 6px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span style={{ color: "var(--accent-success)", opacity: 0.8 }} className="font-mono text-[9px] uppercase tracking-wider">WASM · AST Built</span>
            <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--accent-success)", opacity: 0.5 }}>2ms</span>
          </div>

          {/* Render Ready */}
          <div className="absolute inset-0 px-5 flex items-center gap-2.5" style={{ animation: "status-text-ready 8s infinite step-end" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 6px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span style={{ color: "var(--accent-success)", opacity: 0.8 }} className="font-mono text-[9px] uppercase tracking-wider">WASM · Render Ready</span>
            <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--accent-success)", opacity: 0.5 }}>4ms</span>
          </div>
        </div>
      </div>

      {/* AST Mini Visualization */}
      <div className="mt-8 flex items-start gap-3 select-none">
        <div className="flex flex-col items-center gap-0 pt-0.5">
          <div className="w-px h-14" style={{ background: "var(--border-hairline)" }} />
        </div>
        <div className="font-mono text-[10px] space-y-[4px] leading-relaxed">
          {/* Node 1 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-1 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 4px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span className="text-(--ink-secondary)">Form: Signup</span>
          </div>
          {/* Node 2 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-2 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 4px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span className="text-(--ink-secondary)">Field: email (Type: email)</span>
          </div>
          {/* Node 3 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-3 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 4px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span className="text-(--ink-secondary)">Field: password (Type: text)</span>
          </div>
          {/* Node 4 */}
          <div className="flex items-center gap-2" style={{ animation: "ast-node-4 8s infinite ease-out" }}>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--accent-success)", boxShadow: "0 0 4px color-mix(in srgb, var(--accent-success) 60%, transparent)" }} />
            <span className="text-(--ink-secondary)">Action: submit</span>
          </div>
        </div>
      </div>

      {/* Subdued blueprint text */}
      <div className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-widest text-(--ink-tertiary)">
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
    <div className="min-h-screen flex bg-(--bg-subtle)">

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — 40% — Visual Centerpiece
      ══════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[40%] shrink-0 relative overflow-hidden bg-(--bg-subtle)"
        style={{ borderRight: "1px solid var(--border-hairline)" }}
      >
        <div className="glow-accent -left-24 -top-24 h-72 w-72" />
        <BlueprintGrid />

        {/* Technical Corner Accents */}
        <div className="absolute top-0 left-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute top-6 left-6 w-4 h-px" style={{ background: "var(--border-hairline)" }} />
          <div className="absolute top-6 left-6 w-px h-4" style={{ background: "var(--border-hairline)" }} />
        </div>
        <div className="absolute top-0 right-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute top-6 right-6 w-4 h-px" style={{ background: "var(--border-hairline)" }} />
          <div className="absolute top-6 right-6 w-px h-4" style={{ background: "var(--border-hairline)" }} />
        </div>
        <div className="absolute bottom-0 left-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute bottom-6 left-6 w-4 h-px" style={{ background: "var(--border-hairline)" }} />
          <div className="absolute bottom-6 left-6 w-px h-4" style={{ background: "var(--border-hairline)" }} />
        </div>
        <div className="absolute bottom-0 right-0 w-12 h-12 pointer-events-none z-10">
          <div className="absolute bottom-6 right-6 w-4 h-px" style={{ background: "var(--border-hairline)" }} />
          <div className="absolute bottom-6 right-6 w-px h-4" style={{ background: "var(--border-hairline)" }} />
        </div>

        {/* Left Side Content */}
        <div className="relative z-10 flex flex-col h-full px-12 xl:px-14 py-12 justify-between">
          {/* Logo — shared brand mark + wordmark (design.md §Logo) */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <FormixLogo size={22} variant="color" aria-hidden="true" />
            <span className="font-display text-2xl tracking-tight transition-opacity duration-150 group-hover:opacity-75 text-(--ink-primary)">
              Formix
            </span>
            <span className="font-mono text-[11px] mt-1 transition-opacity duration-150 group-hover:opacity-50 text-(--ink-tertiary)">
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
            style={{ borderColor: "var(--border-hairline)" }}
          >
            {[
              { label: "Hand-written C++ compiler", step: "01" },
              { label: "Compiled to WebAssembly", step: "02" },
              { label: "Runs entirely in your browser", step: "03" },
            ].map(({ label, step }, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="font-mono text-[9px] w-6 text-right text-(--ink-disabled)">
                  {step}
                </span>
                <span className="font-mono text-[10px] text-(--ink-tertiary)">
                  {label}
                </span>
                {i < 2 && (
                  <span className="ml-auto font-mono text-[9px] text-(--ink-disabled)">
                    ↓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — 60% — Authentication form, theme-aware
      ══════════════════════════════════════════════════════ */}
      <div className="relative flex min-h-screen flex-1 flex-col bg-background">
        {/* Micro coordinate dots — theme-aware via .bg-dot-grid */}
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60" />

        {/* Mobile Header */}
        <div className="relative z-10 flex items-center justify-between px-8 pt-8 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <FormixLogo size={22} variant="color" aria-hidden="true" />
            <span className="font-display text-2xl tracking-tight text-foreground">Formix</span>
            <span className="mt-1 font-mono text-xs text-muted-foreground">.forml</span>
          </Link>
        </div>

        {/* Centered Auth Card Area */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-10 py-20 sm:px-16">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-border px-12 py-6">
          <p className="font-mono text-xs text-muted-foreground">© 2026 Formix</p>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
              Docs
            </Link>
            <Link href="/" className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
