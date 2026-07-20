// hooks/use-form-validation.ts
//
// React hook that wraps the pure validation functions from lib/forml-validate.ts
// with stateful tracking of which fields have been "touched" (interacted with).
//
// Usage:
//   const { errors, touched, markTouched, validateAll, resetValidation } =
//     useFormValidation(stmts, values);
//
//   - errors:          Record<string, string>  — current validation errors (always fresh)
//   - touched:         Record<string, boolean> — which keys the user has interacted with
//   - markTouched:     (key: string) => void   — call on field blur
//   - validateAll:     () => Record<string, string> — marks all keys touched + returns errors
//   - resetValidation: () => void              — clears touched state

"use client";

import { useState, useMemo, useCallback } from "react";
import type { ASTNode } from "@/components/form-renderer";
import { validateForm } from "@/lib/forml-validate";

export interface FormValidationState {
  /** Current error map (field key → message). Always up-to-date with values. */
  errors: Record<string, string>;
  /** Which field keys the user has "touched" (blurred or attempted submit). */
  touched: Record<string, boolean>;
  /** Mark a field as touched (call on blur). */
  markTouched: (key: string) => void;
  /** Mark all field keys as touched and return the current error map.
   *  Use before form submission to surface all errors at once. */
  validateAll: () => Record<string, string>;
  /** Reset touched state (e.g. after successful submission). */
  resetValidation: () => void;
}

/**
 * Manages form validation state.
 *
 * @param stmts  Flat list of AST statements (pages + root statements).
 * @param values Current form values.
 */
export function useFormValidation(
  stmts: ASTNode[],
  values: Record<string, string>,
): FormValidationState {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Recompute errors whenever values or stmts change.
  const errors = useMemo(
    () => validateForm(stmts, values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stmts, values],
  );

  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const validateAll = useCallback((): Record<string, string> => {
    // Build the full touched map from all field keys in errors + all current keys.
    const allTouched: Record<string, boolean> = {};
    Object.keys(errors).forEach((k) => { allTouched[k] = true; });
    // Also touch any field that has a value (even if no error).
    Object.keys(values).forEach((k) => { allTouched[k] = true; });
    setTouched(allTouched);
    return errors;
  }, [errors, values]);

  const resetValidation = useCallback(() => {
    setTouched({});
  }, []);

  return { errors, touched, markTouched, validateAll, resetValidation };
}
