"use client";

/**
 * components/form-renderer/index.tsx
 *
 * Shared schema-driven form renderer extracted from demo-ide-shell.tsx.
 * Used by:
 *   - PreviewPanel inside the IDE editor (demo-ide-shell.tsx)
 *   - The public respondent page (app/f/[formId]/form-renderer.tsx)
 *
 * Nothing in this file touches the Monaco editor, the WASM compiler,
 * diagnostic state, or cursor position — it is intentionally editor-free.
 */

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ── Shared type ───────────────────────────────────────────────────────────────

/** Generic AST node from the Forml WASM compiler output. */
export type ASTNode = Record<string, unknown>;

// ── Shared styles ─────────────────────────────────────────────────────────────

export const INPUT_CLS =
  "w-full rounded border border-[#D4CCB8] bg-[#F5F3EE] px-3 py-2 font-inter text-[12px] text-[#222016] outline-none placeholder:text-[#B4AA96] transition-all duration-150 focus:border-[#7C6FE0] focus:ring-2 focus:ring-[#7C6FE0]/10";

export const INPUT_CLS_ERROR =
  "w-full rounded border border-[#E05252] bg-[#FDF5F5] px-3 py-2 font-inter text-[12px] text-[#222016] outline-none placeholder:text-[#B4AA96] transition-all duration-150 focus:border-[#E05252] focus:ring-2 focus:ring-[#E05252]/10";

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

// ── DynamicField ──────────────────────────────────────────────────────────────

/**
 * Renders a single form field from an AST Field node.
 * Supports: text, email, url, date, integer, float, select, radio,
 *           checkbox (multi), boolean (single toggle).
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
}: {
  field: ASTNode;
  nameKey: string;
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onBlur?: (key: string) => void;
  repeatIndex?: number;
  error?: string;
  touched?: boolean;
}) {
  const showError = !!(touched && error);
  const inputCls = showError ? INPUT_CLS_ERROR : INPUT_CLS;
  const fieldType = field.fieldType as string;
  const options   = (field.options as string[]) ?? [];
  const ui        = field.ui as ASTNode | undefined;
  const label     = (ui?.label as string) ?? (field.name as string);
  const placeholder = (ui?.placeholder as string) ?? "";
  const helpText  = (ui?.helpText as string) ?? "";
  const value     = values[nameKey] ?? "";

  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-1.5 font-inter text-[11px] font-semibold tracking-wide text-[#3D3528]">
        {label}
        {repeatIndex !== undefined && (
          <span className="font-inter text-[9px] font-normal text-[#9A9080]">
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
            className={(showError ? INPUT_CLS_ERROR : INPUT_CLS) + " appearance-none"}
          >
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-[#7C6FE0]" />
        </div>
      )}

      {fieldType === "radio" && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 font-inter text-[12px] text-[#222016] cursor-pointer">
              <input
                type="radio"
                name={nameKey}
                value={o}
                checked={value === o}
                onChange={() => onChange(nameKey, o)}
                onBlur={() => onBlur?.(nameKey)}
                className="accent-[#7C6FE0]"
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
              <label key={o} className="flex items-center gap-2 font-inter text-[12px] text-[#222016] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ck}
                  onChange={(e) => onChange(`${nameKey}__${o}`, e.target.checked ? "true" : "false")}
                  onBlur={() => onBlur?.(nameKey)}
                  className="accent-[#7C6FE0]"
                />
                {o}
              </label>
            );
          })}
        </div>
      )}

      {fieldType === "boolean" && (
        <label className="flex items-center gap-2 font-inter text-[12px] text-[#222016] cursor-pointer">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(nameKey, e.target.checked ? "true" : "false")}
            onBlur={() => onBlur?.(nameKey)}
            className="accent-[#7C6FE0]"
          />
          {placeholder || label}
        </label>
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

      {!["select", "radio", "checkbox", "boolean", "integer", "float"].includes(fieldType) && (
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
        <p className="font-inter text-[10px] text-[#8A8070]">{helpText}</p>
      )}

      {showError && (
        <p role="alert" className="mt-0.5 flex items-center gap-1 font-inter text-[10px] text-[#E05252]">
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
}: {
  stmts: ASTNode[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onBlur?: (key: string) => void;
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
  depth?: number;
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
                <div className="flex items-center gap-2 rounded border border-dashed border-[#D0C8B4] bg-[#F8F6F0] px-4 py-3">
                  <span className="text-[#C0B8A0] text-[18px]">↑</span>
                  <p className="font-inter text-[11px] text-[#9A9080]">
                    Set{" "}
                    <code className="rounded bg-[#EDE8E0] px-1 font-mono text-[10px] text-[#4A4030]">
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
                    className="overflow-hidden rounded border border-[#D4CCB8] bg-[#F5F3EE]"
                  >
                    <div className="flex items-center gap-2 border-b border-[#E4DCD0] bg-[#EDE9E2] px-4 py-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7C6FE0] font-inter text-[10px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-inter text-[11px] font-medium text-[#3D3528]">
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
                <div className="space-y-4 border-l-2 border-[#7C6FE0]/40 pl-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#9A9080]">
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
                <span className="flex-none font-inter text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C6FE0]">
                  {sectionName}
                </span>
                <span className="h-px flex-1 bg-[#E0D8C8]" />
              </div>
              <RenderStatements
                stmts={sectionStmts}
                values={values}
                onChange={onChange}
                onBlur={onBlur}
                errors={errors}
                touched={touched}
                depth={depth + 1}
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
