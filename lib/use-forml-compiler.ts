// lib/use-forml-compiler.ts
// React hook that loads the pre-built Forml WASM compiler (public/wasm/forml.js)
// and exposes a stable `compile(source)` function once the runtime is ready.
//
// The WASM module uses Emscripten's embind and attaches `compileForml` to the
// global Module object.  We inject the script tag once per page lifecycle.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types returned by the WASM compiler ──────────────────────────────────────

export interface FormlDiagnostic {
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface FormlCompileResult {
  /** Serialised AST as a JS value (already JSON.parsed). null when parsing failed. */
  ast: Record<string, unknown> | null;
  diagnostics: FormlDiagnostic[];
  /** True iff ast !== null AND diagnostics has no errors. */
  ok: boolean;
  /** Wall-clock time in ms the compile() call took. */
  durationMs: number;
}

// ── Singleton script-loading state ───────────────────────────────────────────

type LoadState = "idle" | "loading" | "ready" | "error";

let globalLoadState: LoadState = "idle";
const subscribers: Array<(state: LoadState) => void> = [];

function notifySubscribers(state: LoadState) {
  globalLoadState = state;
  subscribers.forEach((fn) => fn(state));
}

function loadWasm(): void {
  if (globalLoadState !== "idle") return;
  notifySubscribers("loading");

  // Emscripten module config – must be set BEFORE the script is injected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  g.Module = g.Module ?? {};
  g.Module.onRuntimeInitialized = () => {
    notifySubscribers("ready");
  };

  const script = document.createElement("script");
  script.src = "/wasm/forml.js";
  script.async = true;
  script.onerror = () => {
    console.error("[forml-wasm] Failed to load /wasm/forml.js");
    notifySubscribers("error");
  };
  document.head.appendChild(script);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFormlCompiler() {
  const [loadState, setLoadState] = useState<LoadState>(globalLoadState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handler = (state: LoadState) => {
      if (mountedRef.current) setLoadState(state);
    };

    subscribers.push(handler);

    // Kick off loading if we haven't yet.
    if (globalLoadState === "idle") {
      loadWasm();
    } else {
      // Sync to whatever the current state is.
      setLoadState(globalLoadState);
    }

    return () => {
      mountedRef.current = false;
      const idx = subscribers.indexOf(handler);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }, []);

  const compile = useCallback((source: string): FormlCompileResult => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;

    if (typeof g.Module?.compileForml !== "function") {
      return {
        ast: null,
        diagnostics: [
          {
            line: 0,
            col: 0,
            severity: "error",
            message: "WASM compiler not yet initialised.",
          },
        ],
        ok: false,
        durationMs: 0,
      };
    }

    const t0 = performance.now();
    let rawJson: string;
    try {
      rawJson = g.Module.compileForml(source) as string;
    } catch (err) {
      return {
        ast: null,
        diagnostics: [
          {
            line: 0,
            col: 0,
            severity: "error",
            message: `WASM runtime error: ${err}`,
          },
        ],
        ok: false,
        durationMs: Math.round(performance.now() - t0),
      };
    }

    const durationMs = Math.round(performance.now() - t0);

    let parsed: { ast: Record<string, unknown> | null; diagnostics: FormlDiagnostic[] };
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return {
        ast: null,
        diagnostics: [
          { line: 0, col: 0, severity: "error", message: "Failed to parse compiler output." },
        ],
        ok: false,
        durationMs,
      };
    }

    const hasErrors = parsed.diagnostics.some((d) => d.severity === "error");
    return {
      ast: parsed.ast ?? null,
      diagnostics: parsed.diagnostics,
      ok: parsed.ast !== null && !hasErrors,
      durationMs,
    };
  }, []);

  return {
    /** true once compileForml is callable */
    ready: loadState === "ready",
    /** true while the script/wasm is still loading */
    loading: loadState === "loading",
    /** true if the wasm script failed to load */
    loadError: loadState === "error",
    compile,
  };
}
