"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import {
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";
import { getForm, submitForm, submitFormWithFiles, type PublicFormResponse } from "@/lib/api";
import { useFormValidation } from "@/hooks/use-form-validation";
import { formHasFileFields } from "@/lib/forml-validate";
import { deriveComputedValues, formPageSteps, numericVariables, pruneInactiveRepeatEntries } from "@/lib/forml-runtime";

type SubmitState = "idle" | "submitting" | "success" | "redirecting" | "error";

export function FormRenderer({ formId }: { formId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incomingSession = searchParams.get("session") ?? undefined;

  const [schema,      setSchema]      = useState<PublicFormResponse | null>(null);
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [formValues,  setFormValues]  = useState<Record<string, string>>({});
  const [files,       setFiles]       = useState<Record<string, File[]>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Fetch published form schema on mount. Carrying forward ?session= keeps a
  // respondent's answers correlated across a chained (form -> next_form) flow.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getForm(formId, incomingSession)
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
          setSessionId(data.session_id);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if ((err as { status?: number })?.status === 404) setNotFound(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [formId, incomingSession]);

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleFileChange = useCallback((key: string, selected: File[]) => {
    setFiles((prev) => ({ ...prev, [key]: selected }));
  }, []);

  const pageSteps = useMemo(
    () => formPageSteps(schema?.compiled_schema ?? null),
    [schema],
  );
  const allStatements = useMemo<ASTNode[]>(
    () => pageSteps.flatMap((page) => page.statements),
    [pageSteps],
  );
  const currentStep = pageSteps[Math.min(pageIndex, Math.max(pageSteps.length - 1, 0))];
  const visibleStatements = currentStep?.statements ?? [];
  const hasMultiplePages = pageSteps.length > 1;
  const isLastPage = pageIndex >= pageSteps.length - 1;

  const variables = useMemo(
    () => numericVariables(schema?.compiled_schema ?? null),
    [schema],
  );
  const effectiveValues = useMemo(() => ({
    ...formValues,
    ...deriveComputedValues(allStatements, formValues, variables),
  }), [allStatements, formValues, variables]);

  // ── Validation ────────────────────────────────────────────────────────────
  // Starts clean — nothing is pre-touched, so a freshly opened (or reopened)
  // form never shows errors until the respondent actually interacts with it.
  const { errors, touched, markTouched, validateAll, validateSubset, resetValidation } =
    useFormValidation(allStatements, effectiveValues, files);

  // Chained multi-form flows (Form.next_form_id) reuse this same component
  // instance across navigations — reset all per-form state so the next form
  // in the chain opens clean instead of inheriting the previous form's
  // values/touched state.
  const prevFormId = useRef<string | null>(null);
  useEffect(() => {
    if (prevFormId.current !== null && prevFormId.current !== formId) {
      setFormValues({});
      setFiles({});
      setPageIndex(0);
      resetValidation();
    }
    prevFormId.current = formId;
  }, [formId, resetValidation]);

  const errorCount = Object.keys(errors).filter((key) => touched[key]).length;

  const hasFileFields = useMemo(() => formHasFileFields(allStatements), [allStatements]);

  const hasTouched = Object.keys(touched).length > 0;

  const goToNextPage = useCallback(() => {
    if (Object.keys(validateSubset(visibleStatements)).length > 0) return;
    setPageIndex((current) => Math.min(current + 1, pageSteps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageSteps.length, validateSubset, visibleStatements]);

  const goToPreviousPage = useCallback(() => {
    setPageIndex((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!schema || submitState === "submitting") return;

    // Gate on validation — surface all errors before submitting.
    const currentErrors = validateAll();
    if (Object.keys(currentErrors).length > 0) return;

    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const submittedValues = pruneInactiveRepeatEntries(allStatements, effectiveValues, effectiveValues);
      const submittedFiles = pruneInactiveRepeatEntries(allStatements, effectiveValues, files);
      const result = hasFileFields
        ? await submitFormWithFiles(formId, submittedValues, submittedFiles, sessionId ?? undefined)
        : await submitForm(formId, submittedValues, sessionId ?? undefined);
      setSubmissionId(result.submission_id);

      if (result.next_form_id) {
        setSubmitState("redirecting");
        const query = result.session_id ? `?session=${encodeURIComponent(result.session_id)}` : "";
        setTimeout(() => router.push(`/f/${result.next_form_id}${query}`), 900);
      } else {
        setSubmitState("success");
      }
    } catch (err) {
      setSubmitState("error");
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed — please try again.",
      );
    }
  }, [schema, formId, allStatements, effectiveValues, files, hasFileFields, sessionId, submitState, validateAll, router]);

  const formTitle = schema?.compiled_schema
    ? ((schema.compiled_schema.name as string) ?? schema.title)
    : "";

  const fieldCount = allStatements.filter((s) => s.type === "Field").length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading form…</p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <AlertCircle className="h-7 w-7 text-accent" />
          </div>
          <p className="text-base font-bold text-foreground">Form not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This form doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
        </div>
      </div>
    );
  }

  // ── Redirecting to next form in the chain ───────────────────────────────────
  if (submitState === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <ArrowRight className="h-7 w-7 animate-pulse text-accent" />
          </div>
          <p className="text-base font-semibold text-foreground">Thanks! Continuing to the next form…</p>
        </motion.div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 ring-4 ring-accent/10"
          >
            <CheckCircle2 className="h-10 w-10 text-accent" />
          </motion.div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground">Response submitted!</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Thank you for filling out{" "}
              <span className="font-semibold text-foreground">{formTitle}</span>.
            </p>
          </div>
          {submissionId && (
            <p className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
              Submission ID: {submissionId}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setFormValues({});
              setFiles({});
              setPageIndex(0);
              resetValidation();
              setSubmitState("idle");
              setSubmitError(null);
              setSubmissionId(null);
            }}
            className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:border-accent/40 hover:text-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Submit another response
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      {/* Formix badge */}
      <div className="fixed left-4 top-4 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-card/90 px-2.5 py-1 text-xs font-semibold text-accent shadow-sm backdrop-blur transition-colors hover:border-accent/40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Formix
        </Link>
      </div>

      <div className="mx-auto w-full max-w-[540px]">
        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="shadow-elevated overflow-hidden rounded-xl border border-border bg-card"
        >
          {/* Header */}
          <div className="border-b border-border bg-muted/50 px-7 py-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                Form
              </span>
              {fieldCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                </span>
              )}
              {hasMultiplePages && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Step {pageIndex + 1} of {pageSteps.length}
                </span>
              )}
            </div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
              {formTitle}
            </h1>
            {hasMultiplePages && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border/70" role="progressbar" aria-valuemin={1} aria-valuemax={pageSteps.length} aria-valuenow={pageIndex + 1}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((pageIndex + 1) / pageSteps.length) * 100}%` }} />
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-5 px-7 py-7">
            <AnimatePresence>
              {visibleStatements.length > 0 ? (
                <motion.div
                  key={`page-${pageIndex}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {currentStep?.name && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Current step</p>
                      <h2 className="mt-1 text-lg font-semibold text-foreground">{currentStep.name}</h2>
                    </div>
                  )}
                  <RenderStatements
                  stmts={visibleStatements}
                  values={effectiveValues}
                  onChange={handleChange}
                  onBlur={markTouched}
                  errors={hasTouched ? errors : {}}
                  touched={touched}
                  files={files}
                  onFileChange={handleFileChange}
                  variables={variables}
                  />
                </motion.div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No fields found in this form.
                </p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit footer */}
          <div className="border-t border-border px-7 py-5">
            <AnimatePresence mode="wait">
              {errorCount > 0 && hasTouched && (
                <motion.div
                  key="validation-summary"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
                  <p className="text-sm leading-relaxed text-destructive">
                    Please fix {errorCount} {errorCount === 1 ? "error" : "errors"} before submitting.
                  </p>
                </motion.div>
              )}
              {submitError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
                  <p className="text-sm leading-relaxed text-destructive">
                    {submitError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {hasMultiplePages && pageIndex > 0 && (
                <button type="button" onClick={goToPreviousPage} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {!isLastPage ? (
                <button type="button" onClick={goToNextPage} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.99]">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  id="submit-form-btn"
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitState === "submitting"}
                  className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitState === "submitting" ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit Response"
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="text-accent transition-colors hover:opacity-75">
            Formix
          </Link>
        </p>
      </div>
    </div>
  );
}
