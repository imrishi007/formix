"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  RenderStatements,
  type ASTNode,
} from "@/components/form-renderer";
import { getForm, submitForm, type PublicFormResponse } from "@/lib/api";
import { useFormValidation } from "@/hooks/use-form-validation";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function FormRenderer({ formId }: { formId: string }) {
  const [schema,      setSchema]      = useState<PublicFormResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [formValues,  setFormValues]  = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Fetch published form schema on mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getForm(formId)
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
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
  }, [formId]);

  const handleChange = useCallback((key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }, []);

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
  const { errors, touched, markTouched, validateAll, resetValidation } =
    useFormValidation(allStatements, formValues);

  const errorCount = Object.keys(errors).length;

  const hasTouched = Object.keys(touched).length > 0;

  const handleSubmit = useCallback(async () => {
    if (!schema || submitState === "submitting") return;

    // Gate on validation — surface all errors before submitting.
    const currentErrors = validateAll();
    if (Object.keys(currentErrors).length > 0) return;

    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const result = await submitForm(formId, formValues);
      setSubmissionId(result.submission_id);
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed — please try again.",
      );
    }
  }, [schema, formId, formValues, submitState, validateAll]);

  // (allStatements moved above useFormValidation)

  const formTitle = schema?.compiled_schema
    ? ((schema.compiled_schema.name as string) ?? schema.title)
    : "";

  const fieldCount = allStatements.filter((s) => s.type === "Field").length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#7C6FE0]" />
          <p className="font-inter text-[12px] text-[#9A9080]">Loading form…</p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFF]">
            <AlertCircle className="h-7 w-7 text-[#7C6FE0]" />
          </div>
          <p className="font-inter text-[16px] font-bold text-[#1A1410]">
            Form not found
          </p>
          <p className="mt-2 font-inter text-[13px] text-[#9A9080]">
            This form doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7] px-4">
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
              Submission ID: {submissionId}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setFormValues({});
              resetValidation();
              setSubmitState("idle");
              setSubmitError(null);
              setSubmissionId(null);
            }}
            className="mt-2 flex items-center gap-2 rounded-lg border border-[#D4CCB8] bg-[#F5F3EE] px-5 py-2.5 font-inter text-[12px] font-medium text-[#3D3528] transition-all hover:border-[#7C6FE0]/40 hover:bg-[#F0EDE8] hover:text-[#7C6FE0]"
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
    <div className="min-h-screen bg-[#FAF9F7] px-4 py-16">
      {/* Formix badge */}
      <div className="fixed left-4 top-4 z-10">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#7C6FE0]/20 bg-white/90 px-2.5 py-1 font-inter text-[10px] font-semibold text-[#7C6FE0] shadow-sm backdrop-blur transition-colors hover:border-[#7C6FE0]/40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#7C6FE0]" />
          Formix
        </a>
      </div>

      <div className="mx-auto w-full max-w-[540px]">
        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
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
                  {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                </span>
              )}
            </div>
            <h1 className="font-inter text-[26px] font-bold leading-tight tracking-tight text-[#1A1410]">
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
                />
              ) : (
                <p className="font-inter text-[12px] text-[#B4AA96]">
                  No fields found in this form.
                </p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit footer */}
          <div className="border-t border-[#E4DCD0] px-7 py-5">
            <AnimatePresence mode="wait">
              {errorCount > 0 && hasTouched && (
                <motion.div
                  key="validation-summary"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-[#F0CECE] bg-[#FDF5F5] px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-[#E05252]" />
                  <p className="font-inter text-[12px] leading-relaxed text-[#C04040]">
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
                  className="mb-3 flex items-start gap-2.5 rounded-lg border border-[#F0CECE] bg-[#FDF5F5] px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-[#E05252]" />
                  <p className="font-inter text-[12px] leading-relaxed text-[#C04040]">
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
              className="w-full rounded-lg bg-[#7C6FE0] py-3 font-inter text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(124,111,224,0.35)] transition-all duration-150 hover:bg-[#6B5FD0] hover:shadow-[0_4px_16px_rgba(124,111,224,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
        <p className="mt-5 text-center font-inter text-[10px] text-[#C4B8A8]">
          Powered by{" "}
          <a href="/" className="text-[#7C6FE0] transition-colors hover:text-[#6B5FD0]">
            Formix
          </a>
        </p>
      </div>
    </div>
  );
}
