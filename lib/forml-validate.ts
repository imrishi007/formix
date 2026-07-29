// lib/forml-validate.ts
//
// Pure form validation functions.  No React, no DOM, no side-effects.
// Used by:
//   - hooks/use-form-validation.ts  (React hook wrapper)
//   - app/f/[formId]/form-renderer.tsx  (respondent page)
//   - components/workspace/preview-pane.tsx  (author preview)

import type { ASTNode } from "@/components/form-renderer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getValidationRules(field: ASTNode): ASTNode {
  // The compiler serializes a field's validate{} block under the "validation"
  // key (see forml-compiler/JSON_SCHEMA.md) — not "validate".
  return (field.validation as ASTNode) ?? {};
}

function isEmpty(value: string): boolean {
  return value.trim() === "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload field config ──────────────────────────────────────────────────────
// The compiler serializes `field x : upload { ... }` under the "upload" key
// (see forml-compiler/JSON_SCHEMA.md) as { accept: string[], multiple,
// required, maxSize?: string, minFiles?: number, maxFiles?: number }. Legacy
// file/image/pdf/document fields are normalized into this exact same shape
// by the semantic analyzer, so this is the only upload shape the frontend
// ever needs to understand.

export interface UploadConfig {
  accept: string[];
  multiple: boolean;
  required: boolean;
  maxSize?: string;
  minFiles?: number;
  maxFiles?: number;
}

function getUploadConfig(field: ASTNode): UploadConfig | null {
  const upload = field.upload as ASTNode | undefined;
  if (!upload) return null;
  return {
    accept: (upload.accept as string[]) ?? ["any"],
    multiple: !!upload.multiple,
    required: !!upload.required,
    maxSize: upload.maxSize as string | undefined,
    minFiles: upload.minFiles as number | undefined,
    maxFiles: upload.maxFiles as number | undefined,
  };
}

/** Parses a human size string ("10MB", "500 KB", "2GB", or a bare byte
 *  count) into bytes. Returns null if unparseable. */
export function parseSizeString(size: string): number | null {
  const m = size.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (isNaN(value)) return null;
  const unit = (m[2] ?? "B").toUpperCase();
  const multiplier = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }[unit] ?? 1;
  return value * multiplier;
}

/** Maps each `accept` category to a predicate over a File's name/MIME type. */
const ACCEPT_CATEGORY_MATCHERS: Record<string, (file: { name: string; type: string }) => boolean> = {
  image: (f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name),
  pdf: (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
  document: (f) =>
    f.type === "application/pdf" ||
    f.type === "text/plain" ||
    f.type.startsWith("application/msword") ||
    f.type.includes("wordprocessingml") ||
    /\.(docx?|pdf|txt|rtf|odt)$/i.test(f.name),
  video: (f) => f.type.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/i.test(f.name),
  audio: (f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(f.name),
  zip: (f) => f.type === "application/zip" || f.type === "application/x-zip-compressed" || /\.zip$/i.test(f.name),
  any: () => true,
};

/** Checks a File against an `accept` category list (["image","pdf"], or
 *  ["any"]). Unknown categories are ignored (never block upload). */
export function fileMatchesAccept(file: { name: string; type: string }, accept: string[]): boolean {
  if (accept.length === 0 || accept.includes("any")) return true;
  return accept.some((category) => ACCEPT_CATEGORY_MATCHERS[category]?.(file) ?? true);
}

/** Maps `accept` categories to a native `<input accept="...">` attribute
 *  value. Returns undefined for "any" (no restriction, browser accepts everything). */
export function acceptToHtmlAttr(accept: string[]): string | undefined {
  if (accept.length === 0 || accept.includes("any")) return undefined;
  const HTML_ACCEPT: Record<string, string> = {
    image: "image/*",
    pdf: "application/pdf,.pdf",
    document: ".doc,.docx,.pdf,.txt,.rtf,.odt",
    video: "video/*",
    audio: "audio/*",
    zip: ".zip,application/zip",
  };
  const parts = accept.map((c) => HTML_ACCEPT[c]).filter(Boolean);
  return parts.length > 0 ? parts.join(",") : undefined;
}

/** Human-readable summary of an accept list, e.g. "image, pdf" or "any file type". */
export function describeAccept(accept: string[]): string {
  if (accept.length === 0 || accept.includes("any")) return "any file type";
  return accept.join(", ");
}

/** Collect every leaf field name key that appears in the flat statements list. */
function collectFieldKeys(stmts: ASTNode[], values: Record<string, string>): string[] {
  const keys: string[] = [];

  for (const stmt of stmts) {
    const type = stmt.type as string;

    if (type === "Field") {
      keys.push(stmt.name as string);
    } else if (type === "RepeatGroup") {
      const countRef = stmt.countRef as string;
      const rawCount = parseInt(values[countRef] ?? "0", 10);
      const count = Math.min(Math.max(isNaN(rawCount) ? 0 : rawCount, 0), 20);
      const fields = (stmt.fields as ASTNode[]) ?? [];
      for (let i = 0; i < count; i++) {
        for (const f of fields) {
          const fName = f.name as string;
          if (fName) keys.push(`${fName}_repeat_${i}`);
        }
      }
    } else if (type === "Conditional") {
      // Validate branches regardless of condition visibility
      const thenStmts = (stmt.then as ASTNode[]) ?? [];
      const elseStmts = (stmt.else as ASTNode[]) ?? [];
      keys.push(...collectFieldKeys([...thenStmts, ...elseStmts], values));
    } else if (type === "Section" || type === "Layout") {
      const subStmts = (stmt.statements as ASTNode[]) ?? [];
      keys.push(...collectFieldKeys(subStmts, values));
    }
  }

  return keys;
}

/** Find the AST Field node for a given name key (handles repeat keys). */
function findFieldNode(name: string, stmts: ASTNode[]): ASTNode | null {
  // Strip repeat suffix to find original field definition.
  const baseName = name.replace(/_repeat_\d+$/, "");

  for (const stmt of stmts) {
    const type = stmt.type as string;

    if (type === "Field" && (stmt.name as string) === baseName) {
      return stmt;
    }
    if (type === "RepeatGroup") {
      const fields = (stmt.fields as ASTNode[]) ?? [];
      const found = findFieldNode(baseName, fields);
      if (found) return found;
    }
    if (type === "Conditional") {
      const thenStmts = (stmt.then as ASTNode[]) ?? [];
      const elseStmts = (stmt.else as ASTNode[]) ?? [];
      const found = findFieldNode(baseName, [...thenStmts, ...elseStmts]);
      if (found) return found;
    }
    if (type === "Section" || type === "Layout") {
      const subStmts = (stmt.statements as ASTNode[]) ?? [];
      const found = findFieldNode(baseName, subStmts);
      if (found) return found;
    }
  }
  return null;
}

/** True if any Field anywhere in the (possibly nested) statement tree is an
 *  upload type. Used to decide whether a submission needs the multipart
 *  endpoint (lib/api.ts submitFormWithFiles) instead of the plain JSON one. */
export function formHasFileFields(stmts: ASTNode[]): boolean {
  for (const stmt of stmts) {
    const type = stmt.type as string;
    if (type === "Field") {
      if ((stmt.fieldType as string) === "upload") return true;
    } else if (type === "RepeatGroup") {
      if (formHasFileFields((stmt.fields as ASTNode[]) ?? [])) return true;
    } else if (type === "Conditional") {
      const thenStmts = (stmt.then as ASTNode[]) ?? [];
      const elseStmts = (stmt.else as ASTNode[]) ?? [];
      if (formHasFileFields([...thenStmts, ...elseStmts])) return true;
    } else if (type === "Section" || type === "Layout") {
      if (formHasFileFields((stmt.statements as ASTNode[]) ?? [])) return true;
    }
  }
  return false;
}

// ── Core validation logic ─────────────────────────────────────────────────────

/**
 * Validates a single field value against the field's AST validation rules.
 *
 * @param field    The AST FieldNode (must have `.fieldType` and optionally `.validation`).
 * @param nameKey  The key used to look up the value in the values map (may include repeat suffix).
 * @param values   The current form values map.
 * @param files    Selected files for upload fields, keyed the same way as `values`.
 * @returns        An error string if invalid, or null if valid.
 */
export function validateField(
  field: ASTNode,
  nameKey: string,
  values: Record<string, string>,
  files: Record<string, File[]> = {},
): string | null {
  const fieldType = (field.fieldType as string) ?? "text";
  const rules = getValidationRules(field);
  const ui = (field.ui as ASTNode) ?? {};
  const label = (ui.label as string) ?? (field.name as string) ?? nameKey;

  // For checkbox fields the values are keyed as `nameKey__optionValue`.
  // There's no single value — check "required" by looking for at least one true.
  if (fieldType === "checkbox") {
    if (rules.required) {
      const options = (field.options as string[]) ?? [];
      const hasChecked = options.some((o) => values[`${nameKey}__${o}`] === "true");
      if (!hasChecked) return `${label} is required — select at least one option.`;
    }
    return null;
  }

  // Upload fields track selections in `files`, not `values` — no string value to check.
  if (fieldType === "upload") {
    const upload = getUploadConfig(field);
    const selected = files[nameKey] ?? [];

    if (upload?.required && selected.length === 0) {
      return `${label} is required.`;
    }
    if (selected.length === 0) return null;

    if (upload && !upload.multiple && selected.length > 1) {
      return `${label} accepts only one file.`;
    }
    if (upload?.minFiles !== undefined && selected.length < upload.minFiles) {
      return `${label} needs at least ${upload.minFiles} file${upload.minFiles === 1 ? "" : "s"}.`;
    }
    if (upload?.maxFiles !== undefined && selected.length > upload.maxFiles) {
      return `${label} accepts at most ${upload.maxFiles} file${upload.maxFiles === 1 ? "" : "s"}.`;
    }

    const maxSizeBytes = upload?.maxSize ? parseSizeString(upload.maxSize) : null;

    for (const f of selected) {
      if (maxSizeBytes !== null && f.size > maxSizeBytes) {
        return `${label}: "${f.name}" exceeds the ${formatBytes(maxSizeBytes)} size limit.`;
      }
      if (upload && !fileMatchesAccept(f, upload.accept)) {
        return `${label}: "${f.name}" is not an accepted file type (expected ${describeAccept(upload.accept)}).`;
      }
    }
    return null;
  }

  const value = values[nameKey] ?? "";

  // ── required ─────────────────────────────────────────────────────────────
  if (rules.required && isEmpty(value)) {
    return `${label} is required.`;
  }

  // If the field is empty and not required, skip further checks.
  if (isEmpty(value)) return null;

  // ── email ─────────────────────────────────────────────────────────────────
  if (fieldType === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `${label} must be a valid email address.`;
    }
  }

  // ── url ───────────────────────────────────────────────────────────────────
  if (fieldType === "url") {
    try {
      new URL(value);
    } catch {
      return `${label} must be a valid URL (e.g. https://example.com).`;
    }
  }

  // ── integer ───────────────────────────────────────────────────────────────
  if (fieldType === "integer") {
    if (!/^-?\d+$/.test(value.trim())) {
      return `${label} must be a whole number.`;
    }
  }

  // ── float ─────────────────────────────────────────────────────────────────
  if (fieldType === "float") {
    if (isNaN(Number(value))) {
      return `${label} must be a number.`;
    }
  }

  // ── minLength ─────────────────────────────────────────────────────────────
  if (rules.minLength !== undefined) {
    const min = Number(rules.minLength);
    if (value.length < min) {
      return `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`;
    }
  }

  // ── maxLength ─────────────────────────────────────────────────────────────
  if (rules.maxLength !== undefined) {
    const max = Number(rules.maxLength);
    if (value.length > max) {
      return `${label} must be no more than ${max} character${max === 1 ? "" : "s"}.`;
    }
  }

  // ── min (numeric) ─────────────────────────────────────────────────────────
  if (rules.min !== undefined) {
    const min = Number(rules.min);
    if (Number(value) < min) {
      return `${label} must be at least ${min}.`;
    }
  }

  // ── max (numeric) ─────────────────────────────────────────────────────────
  if (rules.max !== undefined) {
    const max = Number(rules.max);
    if (Number(value) > max) {
      return `${label} must be at most ${max}.`;
    }
  }

  // ── pattern ───────────────────────────────────────────────────────────────
  if (rules.pattern) {
    try {
      const regex = new RegExp(rules.pattern as string);
      if (!regex.test(value)) {
        return `${label} does not match the required format.`;
      }
    } catch {
      // Silently ignore invalid regex patterns in form definitions.
    }
  }

  return null;
}

/**
 * Validates all visible fields in a list of AST statements.
 *
 * @param stmts   Top-level statement list (e.g. form.pages[*].statements + form.statements).
 * @param values  Current form values map.
 * @param files   Selected files for upload fields, keyed the same way as `values`.
 * @returns       A map from field name key → error string. Empty map = no errors.
 */
export function validateForm(
  stmts: ASTNode[],
  values: Record<string, string>,
  files: Record<string, File[]> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const keys = collectFieldKeys(stmts, values);

  for (const key of keys) {
    const fieldNode = findFieldNode(key, stmts);
    if (!fieldNode) continue;

    const error = validateField(fieldNode, key, values, files);
    if (error) errors[key] = error;
  }

  return errors;
}
