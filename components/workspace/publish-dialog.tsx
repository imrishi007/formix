"use client";

/**
 * components/workspace/publish-dialog.tsx
 * Success dialog shown after a form is published — public link + embed
 * snippet. Restyled version of the old PublishModal from demo-ide-shell.tsx.
 */

import { useState } from "react";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PublishDialog({ url, embed, onClose }: {
  url: string;
  embed: string;
  onClose: () => void;
}) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const copy = (text: string, setFlag: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setFlag(true);
        setTimeout(() => setFlag(false), 2000);
      },
      () => {
        toast.error("Couldn't copy to clipboard — your browser may be blocking clipboard access.");
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--accent-primary)/30 bg-(--accent-primary)/10">
              <Globe className="h-4 w-4 text-(--accent-primary)" />
            </div>
            <div>
              <DialogTitle>Form Published</DialogTitle>
              <DialogDescription>Share the link or embed it anywhere</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-tertiary)">
              Public Link
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-(--border-hairline) bg-(--bg-subtle) px-3 py-2.5">
              <span className="min-w-0 flex-1 break-all text-sm text-(--ink-primary)">{url}</span>
              <button
                type="button"
                onClick={() => copy(url, setCopiedUrl)}
                aria-label="Copy public link"
                className="flex flex-none items-center gap-1 rounded border border-(--border-hairline) bg-(--bg-surface) px-2 py-1 text-xs text-(--ink-tertiary) transition-colors hover:border-(--accent-primary)/50 hover:text-(--accent-primary)"
              >
                {copiedUrl ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-tertiary)">
              Embed Snippet
            </p>
            <div className="min-w-0 overflow-hidden rounded-lg border border-(--border-hairline) bg-(--bg-subtle) px-3 py-3">
              <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed text-(--ink-primary)">{embed}</pre>
            </div>
            <button
              type="button"
              onClick={() => copy(embed, setCopiedEmbed)}
              aria-label="Copy embed snippet"
              className="mt-2 flex items-center gap-1.5 rounded border border-(--border-hairline) bg-(--bg-surface) px-2.5 py-1.5 text-xs text-(--ink-tertiary) transition-colors hover:border-(--accent-primary)/50 hover:text-(--accent-primary)"
            >
              <Copy className="h-3 w-3" />
              {copiedEmbed ? "Copied!" : "Copy Snippet"}
            </button>
          </div>

          <span className="sr-only" role="status" aria-live="polite">
            {copiedUrl ? "Public link copied to clipboard" : copiedEmbed ? "Embed snippet copied to clipboard" : ""}
          </span>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-(--accent-primary) py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Form in New Tab
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
