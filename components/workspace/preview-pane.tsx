"use client";

/**
 * components/workspace/preview-pane.tsx
 * Live-rendered preview of the form being authored. Restyled version of the
 * old PreviewPanel from demo-ide-shell.tsx — same data flow (flatten AST,
 * useFormValidation), tokens instead of hardcoded hex.
 *
 * Validation starts clean (nothing is pre-touched): a field only shows an
 * error once the author has blurred it with an invalid value, matching the
 * same touched-based UX as the published respondent page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Zap } from "lucide-react";

import { RenderStatements, type ASTNode } from "@/components/form-renderer";
import { useFormValidation } from "@/hooks/use-form-validation";
import type { CompilePhase } from "@/components/workspace/top-bar";

export function PreviewPane({
  ast,
  source,
  compilePhase,
}: {
  ast: ASTNode | null;
  source: string;
  compilePhase: CompilePhase;
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const prevFormName = useRef<string>("");

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleFileChange = useCallback((key: string, selected: File[]) => {
    setFiles((prev) => ({ ...prev, [key]: selected }));
  }, []);

  const allStatements = useMemo<ASTNode[]>(() => {
    if (!ast) return [];
    const pages = (ast.pages as ASTNode[]) ?? [];
    const stmts = (ast.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [ast]);

  // Nothing is pre-touched — errors only appear once the author blurs a
  // field with an invalid value, same as the published respondent page.
  const { errors, touched, markTouched, validateAll, resetValidation } = useFormValidation(allStatements, formValues, files);

  useEffect(() => {
    const name = (ast?.name as string) ?? source.match(/form\s+"([^"]+)"/)?.[1] ?? "";
    if (name !== prevFormName.current) {
      prevFormName.current = name;
      setFormValues({});
      setFiles({});
      resetValidation();
    }
  }, [ast, source, resetValidation]);

  const isError = compilePhase === "error";
  const isParsing = compilePhase === "parsing" || compilePhase === "semantic";

  const fallbackTitle = useMemo(
    () => source.match(/form\s+"([^"]+)"/)?.[1] ?? "Untitled Form",
    [source],
  );
  const formTitle = (ast?.name as string) ?? fallbackTitle;
  const action = ast?.action as ASTNode | undefined;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex h-12 flex-none items-center justify-between border-b border-border bg-card px-5">
        <div>
          <p className="font-inter text-sm font-semibold text-foreground">Live Preview</p>
          <p className="font-inter text-xs text-muted-foreground">Rendered output</p>
        </div>
        {allStatements.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {allStatements.filter((s) => s.type === "Field").length} fields
          </span>
        )}
      </div>

      <div className="bg-dot-grid min-h-0 flex-1 overflow-auto bg-muted/30 p-6">
        <AnimatePresence mode="wait">
          {isError ? (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="flex h-full min-h-[200px] items-center justify-center"
            >
              <div className="flex max-w-xs flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-inter text-sm font-semibold text-foreground">Compile Error</p>
                  <p className="mt-1 font-inter text-xs leading-relaxed text-muted-foreground">
                    Fix errors in the editor — the preview updates automatically.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: isParsing ? 0.4 : 1 }}
              transition={{ duration: 0.15 }}
              className="mx-auto w-full max-w-[380px]"
            >
              <div className="ease-signature shadow-elevated overflow-hidden rounded-2xl border border-border bg-card transition-shadow">
                <div className="border-b border-border px-6 py-6">
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                    Live
                  </span>
                  <h2 className="mt-3 font-inter text-xl font-bold tracking-tight text-foreground">
                    {formTitle}
                  </h2>
                </div>

                <div className="space-y-5 px-6 py-6">
                  {allStatements.length > 0 ? (
                    <RenderStatements
                      stmts={allStatements}
                      values={formValues}
                      onChange={handleChange}
                      onBlur={markTouched}
                      errors={errors}
                      touched={touched}
                      files={files}
                      onFileChange={handleFileChange}
                    />
                  ) : (
                    <p className="font-inter text-sm text-muted-foreground">Parsing form…</p>
                  )}
                </div>

                <div className="border-t border-border px-6 py-5">
                  <button
                    type="button"
                    onClick={() => validateAll()}
                    className="w-full rounded-lg bg-accent py-3 font-inter text-sm font-semibold text-accent-foreground shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                  >
                    Submit Form
                  </button>
                  {action && (
                    <p className="mt-2.5 text-center font-mono text-[10px] text-muted-foreground">
                      {action.method as string} · {action.endpoint as string}
                    </p>
                  )}
                </div>
              </div>

              {allStatements.some((s) => s.type === "RepeatGroup") && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                  <Zap className="mt-0.5 h-3 w-3 flex-none text-accent" />
                  <p className="font-inter text-xs leading-relaxed text-muted-foreground">
                    This form uses <strong className="text-foreground">repeat groups</strong> — enter a number in the count field and new sections appear dynamically.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
