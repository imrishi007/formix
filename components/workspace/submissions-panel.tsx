"use client";

/**
 * components/workspace/submissions-panel.tsx
 * Slide-over listing a form's submissions (GET /forms/{id}/responses).
 * Not a route of its own — kept as a panel so viewing responses doesn't
 * require leaving the workspace.
 */

import { useEffect, useState } from "react";
import { Loader2, Inbox, AlertCircle, ExternalLink, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { getResponses, downloadExport, ApiError, API_BASE, type SubmissionRecord } from "@/lib/api";

/** Uploaded-file metadata as stored in Submission.data by the backend's
 *  multipart submit endpoint (see backend/routers/forms.py). */
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

function SubmissionCell({ value }: { value: unknown }) {
  if (isUploadedFileList(value)) {
    return (
      <div className="flex flex-col gap-1">
        {value.map((f, i) => (
          <a
            key={`${f.url}-${i}`}
            href={`${API_BASE}${f.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-(--accent-primary) underline-offset-2 hover:underline"
          >
            {f.name}
          </a>
        ))}
      </div>
    );
  }
  return <>{String(value ?? "")}</>;
}

export function SubmissionsPanel({ projectId, formId, formTitle, open, onOpenChange }: {
  /** Needed to build the "Open Submission" full-page URL (the author-only
   *  route re-fetches the form via getFormDetail(projectId, formId)). */
  projectId: string | null;
  formId: string | null;
  formTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    setSubmissions(null);
    setError(null);
    getResponses(formId)
      .then((data) => { if (!cancelled) setSubmissions(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load submissions."); });
    return () => { cancelled = true; };
  }, [open, formId]);

  const columns = submissions?.length
    ? Array.from(new Set(submissions.flatMap((s) => Object.keys(s.data))))
    : [];

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!formId || exporting) return;
    setExporting(format);
    try {
      // The API returns a browser-downloadable blob, so this saves directly
      // to the user's machine without exposing response data in a new tab.
      await downloadExport(formId, format, `${formTitle ?? "form"}-responses`);
      toast.success(`Responses exported as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not export responses. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-(--accent-primary)" /> Submissions
          </SheetTitle>
          <SheetDescription>{formTitle ? `Responses for "${formTitle}"` : "Select a form to view its responses."}</SheetDescription>
        </SheetHeader>

        <div className="formix-scroll flex-1 overflow-auto px-4 pb-4">
          {formId && submissions && submissions.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-(--border-hairline) pb-4">
              <span className="mr-auto text-xs text-(--ink-tertiary)">Download every response to your device</span>
              <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("csv")}>
                {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export CSV
              </Button>
              <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("xlsx")}>
                {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                Export Excel
              </Button>
            </div>
          )}
          {!formId && (
            <Empty className="mt-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle className="text-sm">No form selected</EmptyTitle>
                <EmptyDescription>Select a form in the Project Explorer to view its responses.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {formId && submissions === null && !error && (
            <div className="flex items-center justify-center gap-2 py-16 text-(--ink-tertiary)">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading responses…</span>
            </div>
          )}
          {error && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg border border-(--accent-danger)/30 bg-(--accent-danger)/5 px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-(--accent-danger)" />
              <p className="text-sm text-(--accent-danger)">{error}</p>
            </div>
          )}
          {submissions?.length === 0 && (
            <Empty className="mt-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle className="text-sm">No submissions yet</EmptyTitle>
                <EmptyDescription>Responses will appear here as soon as someone fills out the published form.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {submissions && submissions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  {columns.map((col) => <TableHead key={col}>{col}</TableHead>)}
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-(--ink-tertiary)">
                      {new Date(s.submitted_at).toLocaleString()}
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col}><SubmissionCell value={s.data[col]} /></TableCell>
                    ))}
                    <TableCell className="text-right">
                      {formId && projectId && (
                        <button
                          type="button"
                          onClick={() => window.open(`/workspace/submissions/${projectId}/${formId}/${s.id}`, "_blank", "noopener,noreferrer")}
                          className="inline-flex items-center gap-1 rounded border border-(--border-hairline) bg-(--bg-surface) px-2 py-1 text-xs text-(--ink-tertiary) transition-colors hover:border-(--accent-primary)/50 hover:text-(--accent-primary)"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
