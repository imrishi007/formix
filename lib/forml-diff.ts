// lib/forml-diff.ts
//
// Client-side line diff between the current editor source and an AI-produced
// revisedSource, computed with the `diff` package (diffLines).
//
// The Formix AI panel shows a "View diff" toggle per assistant turn. The diff
// renders as a unified-style line list (added lines tinted green, removed
// lines tinted red, unchanged plain) using the app's own accent tokens, so it
// follows whichever syntax theme the app is in.

import { diffLines as computeDiffLines } from "diff";

export type DiffLineType = "add" | "remove" | "unchanged";

export interface DiffLine {
  type: DiffLineType;
  /** The line text (no trailing newline). */
  content: string;
  /** 1-based line number in the OLD source; null for added lines. */
  oldLine: number | null;
  /** 1-based line number in the NEW source; null for removed lines. */
  newLine: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
}

/**
 * Compute a line-granular diff between two FormL sources.
 *
 * The `diff` package is newline-sensitive per line: "line two" (no trailing
 * newline) and "line two\n" compare as different lines, so a source that
 * merely lacks/possesses a final newline renders as a full-line replacement.
 * Normalize both inputs to end in exactly one "\n" up front — that difference
 * is not a meaningful edit.
 */
function normalizeTrailingNewline(source: string): string {
  return source.replace(/\r?\n$/, "") + "\n";
}

export function diffLines(oldSource: string, newSource: string): DiffLine[] {
  const parts = computeDiffLines(
    normalizeTrailingNewline(oldSource),
    normalizeTrailingNewline(newSource),
  );
  const out: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const part of parts) {
    // split() on "\n" yields a trailing "" for a value that ends with a
    // newline — drop it so we emit exactly the lines that exist.
    const lines = part.value.split("\n");
    if (part.value.endsWith("\n")) lines.pop();

    const type: DiffLineType = part.added ? "add" : part.removed ? "remove" : "unchanged";
    for (const content of lines) {
      out.push({
        type,
        content,
        oldLine: type === "add" ? null : oldLine++,
        newLine: type === "remove" ? null : newLine++,
      });
    }
  }
  return out;
}

export function diffStats(oldSource: string, newSource: string): DiffStats {
  let added = 0;
  let removed = 0;
  for (const line of diffLines(oldSource, newSource)) {
    if (line.type === "add") added++;
    else if (line.type === "remove") removed++;
  }
  return { added, removed };
}

/** True when a turn actually produced source changes (the model edited the form). */
export function hasChanges(oldSource: string, newSource: string): boolean {
  return normalizeTrailingNewline(oldSource) !== normalizeTrailingNewline(newSource);
}
