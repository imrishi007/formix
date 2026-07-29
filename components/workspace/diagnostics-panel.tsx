"use client";

/**
 * components/workspace/diagnostics-panel.tsx
 * Bottom panel: Problems / Console / AST / JSON Schema / Tokens tabs.
 * Restyled version of DiagnosticsPanel/DiagnosticsContent from
 * demo-ide-shell.tsx — same data shape, tokens instead of hardcoded hex.
 */

import { useState, useId } from "react";
import { AlertCircle, CheckCircle2, TriangleAlert, X } from "lucide-react";
import type { FormlCompileResult } from "@/lib/use-forml-compiler";
import type { ASTNode } from "@/components/form-renderer";

export type DiagTab = "problems" | "console" | "ast" | "json" | "tokens";

export interface ConsoleLogEntry {
  id: number;
  ts: string;
  level: "info" | "success" | "error";
  message: string;
}

const DIAG_TABS: Array<{ id: DiagTab; label: string }> = [
  { id: "problems", label: "Problems" },
  { id: "console", label: "Console" },
  { id: "ast", label: "AST" },
  { id: "json", label: "JSON Schema" },
  { id: "tokens", label: "Tokens" },
];

function DiagnosticsContent({ tab, compileResult, activeFormTitle, log }: {
  tab: DiagTab; compileResult: FormlCompileResult | null; activeFormTitle: string; log: ConsoleLogEntry[];
}) {
  if (tab === "console") {
    if (log.length === 0) {
      return (
        <div className="p-4 font-mono text-xs text-muted-foreground">
          {"// Console output appears here as you compile and publish."}
        </div>
      );
    }
    return (
      <div className="space-y-0.5 p-2">
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2.5 rounded-sm px-2 py-1 hover:bg-muted/50">
            <span className="flex-none font-mono text-xs text-muted-foreground">{entry.ts}</span>
            <span className={`flex-none font-mono text-xs ${
              entry.level === "error" ? "text-destructive" : entry.level === "success" ? "text-success" : "text-accent"
            }`}>
              {entry.level === "error" ? "✗" : entry.level === "success" ? "✓" : "›"}
            </span>
            <span className="font-mono text-xs leading-relaxed text-foreground">{entry.message}</span>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "problems") {
    const diags = compileResult?.diagnostics ?? [];
    const errors   = diags.filter((d) => d.severity === "error");
    const warnings = diags.filter((d) => d.severity === "warning");
    if (diags.length === 0)
      return (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="font-inter text-sm">No problems detected</span>
        </div>
      );
    return (
      <div className="space-y-1 p-4">
        {[...errors, ...warnings].map((d, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-muted/50">
            {d.severity === "error"
              ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive" />
              : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" />}
            <div>
              <p className={`font-inter text-sm ${d.severity === "error" ? "text-destructive" : "text-warning"}`}>
                {d.message}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {activeFormTitle} · Line {d.line}, Col {d.col}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "ast") {
    return (
      <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        {compileResult?.ast ? JSON.stringify(compileResult.ast, null, 2) : "// No AST — fix compile errors first."}
      </pre>
    );
  }
  if (tab === "json") {
    const ast = compileResult?.ast as ASTNode | null;
    if (!ast) return <pre className="p-4 font-mono text-xs text-muted-foreground">{"// No schema — fix compile errors first."}</pre>;
    const stmts = ((ast.statements as ASTNode[]) ?? []).filter((s) => s.type === "Field");
    const schema = {
      $schema: "https://formix.dev/schema/v1",
      title: ast.name,
      fields: stmts.map((s) => {
        const ui = s.ui as ASTNode | undefined;
        return { name: s.name, type: s.fieldType, label: ui?.label ?? s.name, placeholder: ui?.placeholder, helpText: ui?.helpText, options: (s.options as string[])?.length ? s.options : undefined };
      }),
    };
    return (
      <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        {JSON.stringify(schema, null, 2)}
      </pre>
    );
  }
  if (tab === "tokens") {
    const ast = compileResult?.ast as ASTNode | null;
    if (!ast) return <pre className="p-4 font-mono text-xs text-muted-foreground">{"// Compile to see tokens."}</pre>;
    const stmts = ((ast.statements as ASTNode[]) ?? []).filter((s) => s.type === "Field");
    const tokens = [
      { token: "form", type: "KEYWORD" },
      { token: `"${ast.name}"`, type: "STRING" },
      { token: "{", type: "LBRACE" },
      ...stmts.flatMap((s) => [
        { token: "field", type: "KEYWORD" },
        { token: s.name as string, type: "IDENTIFIER" },
        { token: ":", type: "COLON" },
        { token: s.fieldType as string, type: "TYPE_KEYWORD" },
      ]),
      { token: "}", type: "RBRACE" },
    ];
    return (
      <div className="overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-border">
              {["#", "Token", "Type"].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((tok, i) => (
              <tr key={i} className="border-b border-border transition-colors hover:bg-muted/50">
                <td className="px-4 py-1.5 text-muted-foreground">{i}</td>
                <td className="px-4 py-1.5 text-foreground">{tok.token}</td>
                <td className="px-4 py-1.5 text-accent">{tok.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export function DiagnosticsPanel({ onToggle, compileResult, activeFormTitle, log }: {
  onToggle: () => void; compileResult: FormlCompileResult | null; activeFormTitle: string; log: ConsoleLogEntry[];
}) {
  const [activeTab, setActiveTab] = useState<DiagTab>("problems");
  const errorCount = compileResult?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const warnCount  = compileResult?.diagnostics.filter((d) => d.severity === "warning").length ?? 0;
  const panelId = useId();

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-border bg-card">
      <div role="tablist" aria-label="Diagnostics" className="flex h-9 flex-none items-center border-b border-border px-1">
        {DIAG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={`${panelId}-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex h-full items-center gap-1.5 px-4 font-inter text-xs font-medium transition-colors duration-150 ${
              activeTab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === t.id && (
              <span className="ease-signature absolute inset-x-0 bottom-0 h-[2px] bg-accent" />
            )}
            {t.label}
            {t.id === "problems" && errorCount > 0 && (
              <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded bg-destructive/15 px-1 font-mono text-[10px] font-bold text-destructive">
                {errorCount}
              </span>
            )}
            {t.id === "problems" && warnCount > 0 && errorCount === 0 && (
              <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded bg-warning/15 px-1 font-mono text-[10px] font-bold text-warning">
                {warnCount}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close diagnostics panel"
          title="Close Panel"
          className="ml-auto flex h-full w-9 flex-none items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div
        role="tabpanel"
        id={`${panelId}-${activeTab}`}
        className="formix-scroll min-h-0 flex-1 overflow-auto"
      >
        <DiagnosticsContent tab={activeTab} compileResult={compileResult} activeFormTitle={activeFormTitle} log={log} />
      </div>
    </div>
  );
}
