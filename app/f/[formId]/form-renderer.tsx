"use client";

<<<<<<< HEAD
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
=======
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowRight } from "lucide-react";
>>>>>>> f6620dd (Complete Formix updates)
import {
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";
<<<<<<< HEAD
import { getForm, submitForm, type PublicFormResponse } from "@/lib/api";
import { useFormValidation } from "@/hooks/use-form-validation";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function FormRenderer({ formId }: { formId: string }) {
  const [schema,      setSchema]      = useState<PublicFormResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [formValues,  setFormValues]  = useState<Record<string, string>>({});
=======
import { getForm, submitForm, submitFormWithFiles, type PublicFormResponse } from "@/lib/api";
import { useFormValidation } from "@/hooks/use-form-validation";
import { formHasFileFields } from "@/lib/forml-validate";

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
>>>>>>> f6620dd (Complete Formix updates)
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

<<<<<<< HEAD
  // Fetch published form schema on mount.
=======
  // Fetch published form schema on mount. Carrying forward ?session= keeps a
  // respondent's answers correlated across a chained (form -> next_form) flow.
>>>>>>> f6620dd (Complete Formix updates)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

<<<<<<< HEAD
    getForm(formId)
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
=======
    getForm(formId, incomingSession)
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
          setSessionId(data.session_id);
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
  }, [formId]);
=======
  }, [formId, incomingSession]);
>>>>>>> f6620dd (Complete Formix updates)

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

<<<<<<< HEAD
=======
  const handleFileChange = useCallback((key: string, selected: File[]) => {
    setFiles((prev) => ({ ...prev, [key]: selected }));
  }, []);

>>>>>>> f6620dd (Complete Formix updates)
  // Flatten pages + root statements into a single list for rendering.
  const allStatements = useMemo<ASTNode[]>(() => {
    if (!schema?.compiled_schema) return [];
    const ast = schema.compiled_schema;
    const pages    = (ast.pages    as ASTNode[]) ?? [];
    const stmts    = (ast.statements as ASTNode[]) ?? [];
    const pageStmts = pages.flatMap((p) => (p.statements as ASTNode[]) ?? []);
    return [...pageStmts, ...stmts];
  }, [schema]);

  // ── Validation ────────────────────────────────────────────────────────────
<<<<<<< HEAD
  const { errors, touched, markTouched, validateAll, resetValidation } =
    useFormValidation(allStatements, formValues);

  const errorCount = Object.keys(errors).length;

=======
  // Starts clean — nothing is pre-touched, so a freshly opened (or reopened)
  // form never shows errors until the respondent actually interacts with it.
  const { errors, touched, markTouched, validateAll, resetValidation } =
    useFormValidation(allStatements, formValues, files);

  // Chained multi-form flows (Form.next_form_id) reuse this same component
  // instance across navigations — reset all per-form state so the next form
  // in the chain opens clean instead of inheriting the previous form's
  // values/touched state.
  const prevFormId = useRef<string | null>(null);
  useEffect(() => {
    if (prevFormId.current !== null && prevFormId.current !== formId) {
      setFormValues({});
      setFiles({});
      resetValidation();
    }
    prevFormId.current = formId;
  }, [formId, resetValidation]);

  const errorCount = Object.keys(errors).length;

  const hasFileFields = useMemo(() => formHasFileFields(allStatements), [allStatements]);

>>>>>>> f6620dd (Complete Formix updates)
  const hasTouched = Object.keys(touched).length > 0;

  const handleSubmit = useCallback(async () => {
    if (!schema || submitState === "submitting") return;

    // Gate on validation — surface all errors before submitting.
    const currentErrors = validateAll();
    if (Object.keys(currentErrors).length > 0) return;

    setSubmitState("submitting");
    setSubmitError(null);
    try {
<<<<<<< HEAD
      const result = await submitForm(formId, formValues);
      setSubmissionId(result.submission_id);
      setSubmitState("success");
=======
      const result = hasFileFields
        ? await submitFormWithFiles(formId, formValues, files, sessionId ?? undefined)
        : await submitForm(formId, formValues, sessionId ?? undefined);
      setSubmissionId(result.submission_id);

      if (result.next_form_id) {
        setSubmitState("redirecting");
        const query = result.session_id ? `?session=${encodeURIComponent(result.session_id)}` : "";
        setTimeout(() => router.push(`/f/${result.next_form_id}${query}`), 900);
      } else {
        setSubmitState("success");
      }
>>>>>>> f6620dd (Complete Formix updates)
    } catch (err) {
      setSubmitState("error");
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed — please try again.",
      );
    }
<<<<<<< HEAD
  }, [schema, formId, formValues, submitState, validateAll]);

  // (allStatements moved above useFormValidation)
=======
  }, [schema, formId, formValues, files, hasFileFields, sessionId, submitState, validateAll, router]);
>>>>>>> f6620dd (Complete Formix updates)

  const formTitle = schema?.compiled_schema
    ? ((schema.compiled_schema.name as string) ?? schema.title)
    : "";

  const fieldCount = allStatements.filter((s) => s.type === "Field").length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
<<<<<<< HEAD
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#7C6FE0]" />
          <p className="font-inter text-[12px] text-[#9A9080]">Loading form…</p>
=======
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="font-inter text-sm text-muted-foreground">Loading form…</p>
>>>>>>> f6620dd (Complete Formix updates)
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
<<<<<<< HEAD
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFF]">
            <AlertCircle className="h-7 w-7 text-[#7C6FE0]" />
          </div>
          <p className="font-inter text-[16px] font-bold text-[#1A1410]">
            Form not found
          </p>
          <p className="mt-2 font-inter text-[13px] text-[#9A9080]">
=======
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <AlertCircle className="h-7 w-7 text-accent" />
          </div>
          <p className="font-inter text-base font-bold text-foreground">Form not found</p>
          <p className="mt-2 font-inter text-sm text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
            This form doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  // ── Success ────────────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7] px-4">
=======
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
          <p className="font-inter text-base font-semibold text-foreground">Thanks! Continuing to the next form…</p>
        </motion.div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
            className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#7C6FE0]/20 to-[#A89FE8]/10 ring-4 ring-[#7C6FE0]/10"
          >
            <CheckCircle2 className="h-10 w-10 text-[#7C6FE0]" />
          </motion.div>
          <div>
            <p className="font-inter text-[22px] font-bold tracking-tight text-[#1A1410]">
              Response submitted!
            </p>
            <p className="mt-2 font-inter text-[14px] leading-relaxed text-[#7A7060]">
              Thank you for filling out{" "}
              <span className="font-semibold text-[#3D3528]">{formTitle}</span>.
            </p>
          </div>
          {submissionId && (
            <p className="rounded-md border border-[#E4DCD0] bg-[#F5F3EE] px-3 py-1.5 font-mono text-[10px] text-[#9A9080]">
=======
            className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 ring-4 ring-accent/10"
          >
            <CheckCircle2 className="h-10 w-10 text-accent" />
          </motion.div>
          <div>
            <p className="font-inter text-2xl font-bold tracking-tight text-foreground">Response submitted!</p>
            <p className="mt-2 font-inter text-sm leading-relaxed text-muted-foreground">
              Thank you for filling out{" "}
              <span className="font-semibold text-foreground">{formTitle}</span>.
            </p>
          </div>
          {submissionId && (
            <p className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
              Submission ID: {submissionId}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setFormValues({});
<<<<<<< HEAD
=======
              setFiles({});
>>>>>>> f6620dd (Complete Formix updates)
              resetValidation();
              setSubmitState("idle");
              setSubmitError(null);
              setSubmissionId(null);
            }}
<<<<<<< HEAD
            className="mt-2 flex items-center gap-2 rounded-lg border border-[#D4CCB8] bg-[#F5F3EE] px-5 py-2.5 font-inter text-[12px] font-medium text-[#3D3528] transition-all hover:border-[#7C6FE0]/40 hover:bg-[#F0EDE8] hover:text-[#7C6FE0]"
=======
            className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-5 py-2.5 font-inter text-sm font-medium text-foreground transition-all hover:border-accent/40 hover:text-accent"
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
    <div className="min-h-screen bg-[#FAF9F7] px-4 py-16">
=======
    <div className="min-h-screen bg-background px-4 py-16">
>>>>>>> f6620dd (Complete Formix updates)
      {/* Formix badge */}
      <div className="fixed left-4 top-4 z-10">
        <a
          href="/"
<<<<<<< HEAD
          className="inline-flex items-center gap-1.5 rounded-md border border-[#7C6FE0]/20 bg-white/90 px-2.5 py-1 font-inter text-[10px] font-semibold text-[#7C6FE0] shadow-sm backdrop-blur transition-colors hover:border-[#7C6FE0]/40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#7C6FE0]" />
=======
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-card/90 px-2.5 py-1 font-inter text-xs font-semibold text-accent shadow-sm backdrop-blur transition-colors hover:border-accent/40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
>>>>>>> f6620dd (Complete Formix updates)
          Formix
        </a>
      </div>

      <div className="mx-auto w-full max-w-[540px]">
        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
<<<<<<< HEAD
          className="overflow-hidden rounded-xl border border-[#D4CCB8] bg-white shadow-[0_8px_48px_rgba(0,0,0,0.07)]"
        >
          {/* Header */}
          <div className="border-b border-[#E4DCD0] bg-gradient-to-br from-[#F0EDE5] via-[#EDE8DF] to-[#E8E3D8] px-7 py-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#7C6FE0]/25 bg-[#7C6FE0]/8 px-2.5 py-0.5 font-inter text-[9px] font-semibold uppercase tracking-[0.15em] text-[#7C6FE0]">
                Form
              </span>
              {fieldCount > 0 && (
                <span className="font-inter text-[11px] text-[#9A9080]">
=======
          className="shadow-elevated overflow-hidden rounded-xl border border-border bg-card"
        >
          {/* Header */}
          <div className="border-b border-border bg-muted/50 px-7 py-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-inter text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                Form
              </span>
              {fieldCount > 0 && (
                <span className="font-inter text-xs text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
                  {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                </span>
              )}
            </div>
<<<<<<< HEAD
            <h1 className="font-inter text-[26px] font-bold leading-tight tracking-tight text-[#1A1410]">
=======
            <h1 className="font-inter text-[26px] font-bold leading-tight tracking-tight text-foreground">
>>>>>>> f6620dd (Complete Formix updates)
              {formTitle}
            </h1>
          </div>

          {/* Fields */}
          <div className="space-y-5 px-7 py-7">
            <AnimatePresence>
              {allStatements.length > 0 ? (
                <RenderStatements
                  stmts={allStatements}
                  values={formValues}
                  onChange={handleChange}
                  onBlur={markTouched}
                  errors={hasTouched ? errors : {}}
                  touched={touched}
<<<<<<< HEAD
                />
              ) : (
                <p className="font-inter text-[12px] text-[#B4AA96]">
=======
                  files={files}
                  onFileChange={handleFileChange}
                />
              ) : (
                <p className="font-inter text-sm text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
                  No fields found in this form.
                </p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit footer */}
<<<<<<< HEAD
          <div className="border-t border-[#E4DCD0] px-7 py-5">
=======
          <div className="border-t border-border px-7 py-5">
>>>>>>> f6620dd (Complete Formix updates)
            <AnimatePresence mode="wait">
              {errorCount > 0 && hasTouched && (
                <motion.div
                  key="validation-summary"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
<<<<<<< HEAD
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-[#F0CECE] bg-[#FDF5F5] px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-[#E05252]" />
                  <p className="font-inter text-[12px] leading-relaxed text-[#C04040]">
=======
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
                  <p className="font-inter text-sm leading-relaxed text-destructive">
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-[#F0CECE] bg-[#FDF5F5] px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-[#E05252]" />
                  <p className="font-inter text-[12px] leading-relaxed text-[#C04040]">
=======
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
                  <p className="font-inter text-sm leading-relaxed text-destructive">
>>>>>>> f6620dd (Complete Formix updates)
                    {submitError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              id="submit-form-btn"
              type="button"
              onClick={handleSubmit}
              disabled={submitState === "submitting"}
<<<<<<< HEAD
              className="w-full rounded-lg bg-[#7C6FE0] py-3 font-inter text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(124,111,224,0.35)] transition-all duration-150 hover:bg-[#6B5FD0] hover:shadow-[0_4px_16px_rgba(124,111,224,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
=======
              className="w-full rounded-lg bg-accent py-3 font-inter text-sm font-semibold text-accent-foreground shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
>>>>>>> f6620dd (Complete Formix updates)
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
          </div>
        </motion.div>

        {/* Footer */}
<<<<<<< HEAD
        <p className="mt-5 text-center font-inter text-[10px] text-[#C4B8A8]">
          Powered by{" "}
          <a href="/" className="text-[#7C6FE0] transition-colors hover:text-[#6B5FD0]">
=======
        <p className="mt-5 text-center font-inter text-xs text-muted-foreground">
          Powered by{" "}
          <a href="/" className="text-accent transition-colors hover:opacity-75">
>>>>>>> f6620dd (Complete Formix updates)
            Formix
          </a>
        </p>
      </div>
    </div>
  );
}
