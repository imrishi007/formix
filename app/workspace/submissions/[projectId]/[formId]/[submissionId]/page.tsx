"use client";

/**
 * app/workspace/submissions/[projectId]/[formId]/[submissionId]/page.tsx
 *
 * Dedicated full-page view of a single submission, opened in a new tab via
 * the "Open Submission" action in components/workspace/submissions-panel.tsx.
 * The panel itself stays a quick-preview slide-over — long forms with many
 * fields (or file uploads) get a proper page instead of a cramped sheet.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Paperclip } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { getFormDetail, getResponse, ApiError, API_BASE, type FormDetail, type SubmissionRecord } from "@/lib/api";
import type { ASTNode } from "@/components/form-renderer";

interface UploadedFileMeta {
  name: string;
  size: number;
  mimeType: string | null;
  url: string;
}

function isUploadedFileList(value: unknown): value is UploadedFileMeta[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((v) => v && typeof v === "object" && typeof (v as UploadedFileMeta).url === "string");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Flattens a compiled schema's fields (pages + root, recursing into
 *  Section/Layout/Conditional/RepeatGroup) into a name → label map, so the
 *  raw submission keys can be shown with their author-defined labels. */
function buildLabelMap(schema: ASTNode | null): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!schema) return labels;

  const walk = (stmts: ASTNode[]) => {
    for (const stmt of stmts) {
      const type = stmt.type as string;
      if (type === "Field") {
        const name = stmt.name as string;
        const ui = stmt.ui as ASTNode | undefined;
        labels[name] = (ui?.label as string) ?? name;
      } else if (type === "RepeatGroup") {
        walk((stmt.fields as ASTNode[]) ?? []);
      } else if (type === "Conditional") {
        walk((stmt.then as ASTNode[]) ?? []);
        walk((stmt.else as ASTNode[]) ?? []);
      } else if (type === "Section" || type === "Layout") {
        walk((stmt.statements as ASTNode[]) ?? []);
      }
    }
  };

  const pages = (schema.pages as ASTNode[]) ?? [];
  walk(pages.flatMap((p) => (p.statements as ASTNode[]) ?? []));
  walk((schema.statements as ASTNode[]) ?? []);
  return labels;
}

function ValueDisplay({ value }: { value: unknown }) {
  if (isUploadedFileList(value)) {
    return (
      <div className="flex flex-col gap-1.5">
        {value.map((f, i) => (
          <a
            key={`${f.url}-${i}`}
            href={`${API_BASE}${f.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm text-accent transition-colors hover:border-accent/50 hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5 flex-none" />
            {f.name}
            <span className="text-muted-foreground">({formatBytes(f.size)})</span>
          </a>
        ))}
      </div>
    );
  }
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  return <span className="whitespace-pre-wrap break-words text-foreground">{text}</span>;
}

export default function SubmissionFullPage() {
  const params = useParams<{ projectId: string; formId: string; submissionId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getFormDetail(params.projectId, params.formId),
      getResponse(params.formId, params.submissionId),
    ])
      .then(([formDetail, sub]) => {
        if (cancelled) return;
        setForm(formDetail);
        setSubmission(sub);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load this submission.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user, params.projectId, params.formId, params.submissionId]);

  const labels = useMemo(
    () => buildLabelMap((form?.compiled_schema as ASTNode | null) ?? null),
    [form],
  );

  useEffect(() => {
    if (form) document.title = `Submission — ${form.title} | Formix`;
  }, [form]);

  const entries = useMemo(() => {
    if (!submission) return [];
    return Object.entries(submission.data);
  }, [submission]);

  if (authLoading || !user || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="text-sm text-muted-foreground">Loading submission…</span>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error ?? "Submission not found."}</p>
        <Link href="/editor/demo" className="text-xs text-accent hover:underline">
          Back to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => window.close()}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Close tab
        </button>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/50 px-7 py-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Submission</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {form?.title ?? "Form"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
              <span>ID: {submission.id}</span>
              <span className="h-3 w-px bg-border" />
              <span>{new Date(submission.submitted_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="divide-y divide-border">
            {entries.length === 0 && (
              <p className="px-7 py-6 text-sm text-muted-foreground">No data recorded for this submission.</p>
            )}
            {entries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-1 gap-1 px-7 py-4 sm:grid-cols-[220px_1fr] sm:gap-4">
                <p className="text-sm font-semibold text-foreground">{labels[key] ?? key}</p>
                <div className="text-sm">
                  <ValueDisplay value={value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
