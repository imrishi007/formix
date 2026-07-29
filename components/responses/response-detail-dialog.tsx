"use client";

/**
 * components/responses/response-detail-dialog.tsx
 * Full detail view for one submission — every field's answer plus metadata
 * (device, browser, session, submitted/started timestamps). Renders from the
 * SubmissionRecord already held in the table's loaded data; no extra fetch.
 */

import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { API_BASE, type SubmissionRecord } from "@/lib/api";

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

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function FieldValue({ value }: { value: unknown }) {
  if (isUploadedFileList(value)) {
    return (
      <div className="flex flex-col gap-1">
        {value.map((f, i) => (
          <a
            key={`${f.url}-${i}`}
            href={`${API_BASE}${f.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            {f.name}
          </a>
        ))}
      </div>
    );
  }
  const text = String(value ?? "");
  return <span className="whitespace-pre-wrap break-words">{text || <span className="text-muted-foreground/60">—</span>}</span>;
}

export function ResponseDetailDialog({ submission, onClose, onDelete }: {
  submission: SubmissionRecord;
  onClose: () => void;
  onDelete: () => void;
}) {
  const timeTaken = submission.started_at
    ? formatDuration((new Date(submission.submitted_at).getTime() - new Date(submission.started_at).getTime()) / 1000)
    : null;
  const dataEntries = Object.entries(submission.data);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Response Detail</DialogTitle>
          <DialogDescription>Submitted {new Date(submission.submitted_at).toLocaleString()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 font-mono text-xs">
            <div>
              <p className="text-muted-foreground">Device</p>
              <p className="text-foreground">{submission.device ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Browser</p>
              <p className="truncate text-foreground">{submission.browser ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time taken</p>
              <p className="text-foreground">{timeTaken ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Session</p>
              <p className="truncate text-foreground" title={submission.respondent_session_id ?? undefined}>
                {submission.respondent_session_id ?? "—"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dataEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">This submission has no field data.</p>
            )}
            {dataEntries.map(([key, value]) => (
              <div key={key}>
                <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{key}</p>
                <p className="text-sm text-foreground"><FieldValue value={value} /></p>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete this response
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
