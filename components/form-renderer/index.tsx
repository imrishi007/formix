"use client";

/**
 * components/form-renderer/index.tsx
 *
 * Shared schema-driven form renderer. Used by:
 *   - components/workspace/preview-pane.tsx (the workspace's live preview)
 *   - The public respondent page (app/f/[formId]/form-renderer.tsx)
 *
 * Nothing in this file touches the Monaco editor, the WASM compiler,
 * diagnostic state, or cursor position — it is intentionally editor-free.
 * Styling is expressed entirely through design tokens (bg-background,
 * text-foreground, border-border, etc. from app/globals.css) so both
 * consumers stay light/dark aware for free.
 */

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Paperclip, X } from "lucide-react";
import { acceptToHtmlAttr, formatBytes } from "@/lib/forml-validate";

// ── Shared type ───────────────────────────────────────────────────────────────

/** Generic AST node from the Forml WASM compiler output. */
export type ASTNode = Record<string, unknown>;

// ── Shared styles ─────────────────────────────────────────────────────────────

export const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 font-inter text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-all duration-150 focus:border-ring focus:ring-2 focus:ring-ring/15";

export const INPUT_CLS_ERROR =
  "w-full rounded-lg border border-destructive bg-destructive/5 px-3 py-2 font-inter text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-all duration-150 focus:border-destructive focus:ring-2 focus:ring-destructive/15";

// ── Condition evaluator ───────────────────────────────────────────────────────

/**
 * Evaluate a compiled `when` / conditional AST node against the current
 * form values.  Pure function — no side effects.
 *
 * Handles:
 *   BinaryCond  — { type, operator: "&&"|"||", left, right }
 *   SimpleCond  — { type, field, comparator, value: { valueKind, ... } }
 */
export function evalCondition(
  cond: ASTNode,
  values: Record<string, string>,
): boolean {
  const type = cond.type as string;

  if (type === "BinaryCond") {
    const op = cond.operator as string;
    const l = evalCondition(cond.left as ASTNode, values);
    const r = evalCondition(cond.right as ASTNode, values);
    return op === "&&" ? l && r : l || r;
  }

  if (type === "SimpleCond") {
    const fieldName  = cond.field      as string;
    const comparator = cond.comparator as string;
    const valueNode  = cond.value      as ASTNode;
    const currentVal = values[fieldName] ?? "";
    const vk = valueNode?.valueKind as string;

    let rhs: string;
    if (vk === "number")       rhs = String(valueNode.numberValue  as number);
    else if (vk === "boolean") rhs = String(valueNode.booleanValue as boolean);
    else                       rhs = (valueNode?.text as string) ?? "";

    switch (comparator) {
      case "==": return currentVal === rhs;
      case "!=": return currentVal !== rhs;
      case ">":  return Number(currentVal) >  Number(rhs);
      case "<":  return Number(currentVal) <  Number(rhs);
      case ">=": return Number(currentVal) >= Number(rhs);
      case "<=": return Number(currentVal) <= Number(rhs);
    }
  }

  return false;
}

// ── FileUploadInput ───────────────────────────────────────────────────────────

/** Native file input styled to match the rest of the form, with a running
 *  list of the currently-selected files (name + size + remove). Selection
 *  is fully controlled by the parent — `files` is the source of truth, not
 *  the underlying <input>'s own file list — so callers can clear/replace it. */
function FileUploadInput({
  nameKey,
  accept,
  multiple,
  files,
  onFilesChange,
  onBlur,
  error,
}: {
  nameKey: string;
  accept?: string;
  multiple: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (fileList: FileList | null) => {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return;
    onFilesChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={`file-${nameKey}`}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 font-inter text-sm transition-colors ${
          error ? "border-destructive bg-destructive/5 text-destructive" : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-accent"
        }`}
      >
        <Paperclip className="h-3.5 w-3.5 flex-none" />
        {multiple ? "Choose file(s)" : "Choose file"}
        <input
          id={`file-${nameKey}`}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleSelect(e.target.files)}
          onBlur={onBlur}
          aria-invalid={!!error}
          className="sr-only"
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-inter text-xs text-foreground"
            >
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="flex-none text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
                className="flex-none rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── DynamicField ──────────────────────────────────────────────────────────────

/**
 * Renders a single form field from an AST Field node.
 * Supports: text, email, url, date, integer, float, select, radio,
 *           checkbox (multi), boolean (single toggle), upload.
 */
export function DynamicField({
  field,
  nameKey,
  values,
  onChange,
  onBlur,
  repeatIndex,
  error,
  touched,
  files,
  onFileChange,
}: {
  field: ASTNode;
  nameKey: string;
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onBlur?: (key: string) => void;
  repeatIndex?: number;
  error?: string;
  touched?: boolean;
  /** Selected files for upload fields, keyed the same way as `values`. */
  files?: Record<string, File[]>;
  onFileChange?: (key: string, files: File[]) => void;
}) {
  const showError = !!(touched && error);
  const inputCls = showError ? INPUT_CLS_ERROR : INPUT_CLS;
  const fieldType = field.fieldType as string;
  const options   = (field.options as string[]) ?? [];
  const ui        = field.ui as ASTNode | undefined;
  const upload    = field.upload as ASTNode | undefined;
  const label     = (ui?.label as string) ?? (field.name as string);
  const placeholder = (ui?.placeholder as string) ?? "";
  const helpText  = (ui?.helpText as string) ?? "";
  const value     = values[nameKey] ?? "";
  const isFileField = fieldType === "upload";

  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-1.5 font-inter text-sm font-semibold text-foreground">
        {label}
        {repeatIndex !== undefined && (
          <span className="font-inter text-xs font-normal text-muted-foreground">
            item {repeatIndex + 1}
          </span>
        )}
      </label>

      {fieldType === "select" && (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(nameKey, e.target.value)}
            onBlur={() => onBlur?.(nameKey)}
            aria-invalid={showError}
            className={inputCls + " appearance-none"}
          >
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-accent" />
        </div>
      )}

      {fieldType === "radio" && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-1.5 font-inter text-sm text-foreground">
              <input
                type="radio"
                name={nameKey}
                value={o}
                checked={value === o}
                onChange={() => onChange(nameKey, o)}
                onBlur={() => onBlur?.(nameKey)}
                className="accent-accent"
              />
              {o}
            </label>
          ))}
        </div>
      )}

      {fieldType === "checkbox" && (
        <div className="space-y-1">
          {options.map((o) => {
            const ck = values[`${nameKey}__${o}`] === "true";
            return (
              <label key={o} className="flex cursor-pointer items-center gap-2 font-inter text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={ck}
                  onChange={(e) => onChange(`${nameKey}__${o}`, e.target.checked ? "true" : "false")}
                  onBlur={() => onBlur?.(nameKey)}
                  className="accent-accent"
                />
                {o}
              </label>
            );
          })}
        </div>
      )}

      {fieldType === "boolean" && (
        <label className="flex cursor-pointer items-center gap-2 font-inter text-sm text-foreground">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(nameKey, e.target.checked ? "true" : "false")}
            onBlur={() => onBlur?.(nameKey)}
            className="accent-accent"
          />
          {placeholder || label}
        </label>
      )}

      {isFileField && (
        <FileUploadInput
          nameKey={nameKey}
          accept={acceptToHtmlAttr((upload?.accept as string[]) ?? ["any"])}
          multiple={!!upload?.multiple}
          files={files?.[nameKey] ?? []}
          onFilesChange={(list) => onFileChange?.(nameKey, list)}
          onBlur={() => onBlur?.(nameKey)}
          error={showError ? error : undefined}
        />
      )}

      {(fieldType === "integer" || fieldType === "float") && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(nameKey, e.target.value)}
          onBlur={() => onBlur?.(nameKey)}
          placeholder={placeholder || "0"}
          aria-invalid={showError}
          className={inputCls}
        />
      )}

      {!["select", "radio", "checkbox", "boolean", "integer", "float", "upload"].includes(fieldType) && (
        <input
          type={
            fieldType === "email" ? "email"
            : fieldType === "date" ? "date"
            : fieldType === "url"  ? "url"
            : "text"
          }
          value={value}
          onChange={(e) => onChange(nameKey, e.target.value)}
          onBlur={() => onBlur?.(nameKey)}
          placeholder={placeholder}
          aria-invalid={showError}
          className={inputCls}
        />
      )}

      {helpText && (
        <p className="font-inter text-xs text-muted-foreground">{helpText}</p>
      )}

      {showError && (
        <p role="alert" className="mt-0.5 flex items-center gap-1 font-inter text-xs text-destructive">
          <span className="inline-block h-3 w-3 flex-none" aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

// ── RenderStatements ──────────────────────────────────────────────────────────

/**
 * Recursively renders a list of AST statement nodes.
 * Handles: Field, Conditional (if/else), Section, RepeatGroup, Layout (row/column).
 */
export function RenderStatements({
  stmts,
  values,
  onChange,
  onBlur,
  errors,
  touched,
  depth = 0,
  files,
  onFileChange,
}: {
  stmts: ASTNode[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onBlur?: (key: string) => void;
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
  depth?: number;
  /** Selected files for upload fields, keyed the same way as `values`. */
  files?: Record<string, File[]>;
  onFileChange?: (key: string, files: File[]) => void;
}) {
  return (
    <>
      {stmts.map((stmt, i) => {
        const type = stmt.type as string;
        const key  = `stmt-${depth}-${i}`;

        if (type === "Field") {
          const fieldName = stmt.name as string;
          return (
            <DynamicField
              key={key}
              field={stmt}
              nameKey={fieldName}
              values={values}
              onChange={onChange}
              onBlur={onBlur}
              error={errors?.[fieldName]}
              touched={touched?.[fieldName]}
              files={files}
              onFileChange={onFileChange}
            />
          );
        }

        if (type === "RepeatGroup") {
          const countRef = stmt.countRef as string;
          const rawCount = parseInt(values[countRef] ?? "0", 10);
          const count    = Math.min(Math.max(isNaN(rawCount) ? 0 : rawCount, 0), 20);
          const fields   = (stmt.fields as ASTNode[]) ?? [];

          return (
            <div key={key} className="space-y-3">
              {count === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3">
                  <span className="text-[18px] text-muted-foreground/60">↑</span>
                  <p className="font-inter text-sm text-muted-foreground">
                    Set{" "}
                    <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
                      {countRef}
                    </code>{" "}
                    to a number to generate sections here
                  </p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {Array.from({ length: count }, (_, idx) => (
                  <motion.div
                    key={`${key}-item-${idx}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.22, delay: idx * 0.05 }}
                    className="overflow-hidden rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-inter text-xs font-bold text-accent-foreground">
                        {idx + 1}
                      </span>
                      <span className="font-inter text-sm font-medium text-foreground">
                        {countRef.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} {idx + 1}
                      </span>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      {fields.map((f, fi) => {
                        const fieldName = f.name as string;
                        const nk = `${fieldName}_repeat_${idx}`;
                        return (
                          <DynamicField
                            key={`${key}-${idx}-f${fi}`}
                            field={f}
                            nameKey={nk}
                            values={values}
                            onChange={onChange}
                            onBlur={onBlur}
                            repeatIndex={idx}
                            error={errors?.[nk]}
                            touched={touched?.[nk]}
                            files={files}
                            onFileChange={onFileChange}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          );
        }

        if (type === "Conditional") {
          const condition  = stmt.condition as ASTNode;
          const thenStmts  = (stmt.then as ASTNode[])  ?? [];
          const elseStmts  = (stmt.else as ASTNode[])  ?? [];

          let condMet = false;
          try { condMet = evalCondition(condition, values); } catch { /* ignore */ }

          const branch = condMet ? thenStmts : elseStmts;
          if (branch.length === 0) return null;

          return (
            <AnimatePresence key={key} mode="wait">
              <motion.div
                key={`cond-${key}-${condMet ? "then" : "else"}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-l-2 border-accent/40 pl-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {condMet ? "if" : "else"}
                  </p>
                  <RenderStatements
                    stmts={branch}
                    values={values}
                    onChange={onChange}
                    onBlur={onBlur}
                    errors={errors}
                    touched={touched}
                    depth={depth + 1}
                    files={files}
                    onFileChange={onFileChange}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          );
        }

        if (type === "Section") {
          const sectionName  = stmt.name as string;
          const sectionStmts = (stmt.statements as ASTNode[]) ?? [];
          return (
            <div key={key} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex-none font-inter text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  {sectionName}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <RenderStatements
                stmts={sectionStmts}
                values={values}
                onChange={onChange}
                onBlur={onBlur}
                errors={errors}
                touched={touched}
                depth={depth + 1}
                files={files}
                onFileChange={onFileChange}
              />
            </div>
          );
        }

        if (type === "Layout") {
          const layoutKind  = stmt.layoutKind as string;
          const layoutStmts = (stmt.statements as ASTNode[]) ?? [];
          return (
            <div
              key={key}
              className={layoutKind === "row" ? "grid grid-cols-2 gap-3" : "space-y-4"}
            >
              {layoutStmts.map((ls, li) => (
                <RenderStatements
                  key={`${key}-l${li}`}
                  stmts={[ls]}
                  values={values}
                  onChange={onChange}
                  onBlur={onBlur}
                  errors={errors}
                  touched={touched}
                  depth={depth + 1}
                  files={files}
                  onFileChange={onFileChange}
                />
              ))}
            </div>
          );
        }

        return null;
      })}
    </>
  );
}
