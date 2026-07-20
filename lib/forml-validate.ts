// lib/forml-validate.ts
//
// Pure form validation functions.  No React, no DOM, no side-effects.
// Used by:
//   - hooks/use-form-validation.ts  (React hook wrapper)
//   - app/f/[formId]/form-renderer.tsx  (respondent page)
//   - components/editor/demo-ide-shell.tsx PreviewPanel  (author preview)

import type { ASTNode } from "@/components/form-renderer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getValidationRules(field: ASTNode): ASTNode {
  return (field.validate as ASTNode) ?? {};
}

function isEmpty(value: string): boolean {
  return value.trim() === "";
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

// ── Core validation logic ─────────────────────────────────────────────────────

/**
 * Validates a single field value against the field's AST validation rules.
 *
 * @param field    The AST FieldNode (must have `.fieldType` and optionally `.validate`).
 * @param nameKey  The key used to look up the value in the values map (may include repeat suffix).
 * @param values   The current form values map.
 * @returns        An error string if invalid, or null if valid.
 */
export function validateField(
  field: ASTNode,
  nameKey: string,
  values: Record<string, string>,
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
 * @returns       A map from field name key → error string. Empty map = no errors.
 */
export function validateForm(
  stmts: ASTNode[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const keys = collectFieldKeys(stmts, values);

  for (const key of keys) {
    const fieldNode = findFieldNode(key, stmts);
    if (!fieldNode) continue;

    const error = validateField(fieldNode, key, values);
    if (error) errors[key] = error;
  }

  return errors;
}
