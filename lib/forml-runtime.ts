export type FormlRuntimeNode = Record<string, unknown>;

/** Evaluate the compiler's condition AST against current respondent values. */
export function evaluateCondition(
  condition: FormlRuntimeNode,
  values: Record<string, string>,
): boolean {
  if (condition.type === "BinaryCond") {
    const left = evaluateCondition(condition.left as FormlRuntimeNode, values);
    const right = evaluateCondition(condition.right as FormlRuntimeNode, values);
    return condition.operator === "&&" ? left && right : left || right;
  }
  if (condition.type !== "SimpleCond") return false;

  const current = values[condition.field as string] ?? "";
  const value = condition.value as FormlRuntimeNode;
  const expected = value?.valueKind === "number"
    ? String(value.numberValue)
    : value?.valueKind === "boolean"
      ? String(value.booleanValue)
      : String(value?.text ?? "");

  switch (condition.comparator) {
    case "==": return current === expected;
    case "!=": return current !== expected;
    case ">": return Number(current) > Number(expected);
    case "<": return Number(current) < Number(expected);
    case ">=": return Number(current) >= Number(expected);
    case "<=": return Number(current) <= Number(expected);
    default: return false;
  }
}

/** Read numeric Forml constants from the compiler's root AST. */
export function numericVariables(ast: FormlRuntimeNode | null): Record<string, number> {
  const variables: Record<string, number> = {};
  for (const declaration of (ast?.varDeclarations as FormlRuntimeNode[]) ?? []) {
    const value = declaration.value as FormlRuntimeNode | undefined;
    if (value?.valueKind === "number" && Number.isFinite(value.numberValue)) {
      variables[declaration.name as string] = value.numberValue as number;
    }
  }
  return variables;
}

function evaluateExpression(
  expression: FormlRuntimeNode,
  resolve: (name: string) => number | null,
): number | null {
  if (expression.type === "NumberLiteral") {
    const value = expression.value as number;
    return Number.isFinite(value) ? value : null;
  }
  if (expression.type === "IdentifierExpr") return resolve(expression.name as string);
  if (expression.type !== "BinaryExpr") return null;

  const left = evaluateExpression(expression.left as FormlRuntimeNode, resolve);
  const right = evaluateExpression(expression.right as FormlRuntimeNode, resolve);
  if (left === null || right === null) return null;

  switch (expression.operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return right === 0 ? null : left / right;
    default: return null;
  }
}

interface ComputedField {
  key: string;
  suffix: string;
  expression: FormlRuntimeNode;
}

function collectComputedFields(
  statements: FormlRuntimeNode[],
  values: Record<string, string>,
  suffix = "",
): ComputedField[] {
  const fields: ComputedField[] = [];
  for (const statement of statements) {
    const type = statement.type as string;
    if (type === "Field" && statement.compute) {
      fields.push({
        key: `${statement.name as string}${suffix}`,
        suffix,
        expression: (statement.compute as FormlRuntimeNode).expression as FormlRuntimeNode,
      });
    } else if (type === "RepeatGroup") {
      const rawCount = Number.parseInt(values[statement.countRef as string] ?? "0", 10);
      const count = Math.min(Math.max(Number.isNaN(rawCount) ? 0 : rawCount, 0), 20);
      for (let index = 0; index < count; index++) {
        fields.push(...collectComputedFields(
          (statement.fields as FormlRuntimeNode[]) ?? [],
          values,
          `_repeat_${index}`,
        ));
      }
    } else if (type === "Conditional") {
      fields.push(...collectComputedFields([
        ...((statement.then as FormlRuntimeNode[]) ?? []),
        ...((statement.else as FormlRuntimeNode[]) ?? []),
      ], values, suffix));
    } else if (type === "Section" || type === "Layout") {
      fields.push(...collectComputedFields(
        (statement.statements as FormlRuntimeNode[]) ?? [],
        values,
        suffix,
      ));
    }
  }
  return fields;
}

/**
 * Resolve all computed fields without executing generated JavaScript.
 * Multiple passes allow one computed field to depend on an earlier computed
 * field; the compiler already rejects undefined references and cycles.
 */
export function deriveComputedValues(
  statements: FormlRuntimeNode[],
  values: Record<string, string>,
  variables: Record<string, number> = {},
): Record<string, string> {
  const resolved = { ...values };
  const computed = collectComputedFields(statements, values);

  for (let pass = 0; pass < computed.length; pass++) {
    let changed = false;
    for (const field of computed) {
      const result = evaluateExpression(field.expression, (name) => {
        const raw = resolved[`${name}${field.suffix}`] ?? resolved[name];
        if (raw !== undefined && raw.trim() !== "") {
          const number = Number(raw);
          return Number.isFinite(number) ? number : null;
        }
        return variables[name] ?? null;
      });
      if (result === null || !Number.isFinite(result)) continue;
      const next = String(Number(result.toFixed(10)));
      if (resolved[field.key] !== next) {
        resolved[field.key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return Object.fromEntries(computed.flatMap(({ key }) =>
    resolved[key] === undefined ? [] : [[key, resolved[key]]]
  ));
}

interface RepeatFieldLimit {
  baseName: string;
  count: number;
}

function collectRepeatLimits(
  statements: FormlRuntimeNode[],
  values: Record<string, string>,
): RepeatFieldLimit[] {
  const limits: RepeatFieldLimit[] = [];
  for (const statement of statements) {
    const type = statement.type as string;
    if (type === "RepeatGroup") {
      const raw = Number.parseInt(values[statement.countRef as string] ?? "0", 10);
      const count = Math.min(Math.max(Number.isNaN(raw) ? 0 : raw, 0), 20);
      for (const field of (statement.fields as FormlRuntimeNode[]) ?? []) {
        limits.push({ baseName: field.name as string, count });
      }
    } else if (type === "Conditional") {
      limits.push(...collectRepeatLimits([
        ...((statement.then as FormlRuntimeNode[]) ?? []),
        ...((statement.else as FormlRuntimeNode[]) ?? []),
      ], values));
    } else if (type === "Section" || type === "Layout") {
      limits.push(...collectRepeatLimits(
        (statement.statements as FormlRuntimeNode[]) ?? [],
        values,
      ));
    }
  }
  return limits;
}

/** Remove answers belonging to repeat items that are no longer visible. */
export function pruneInactiveRepeatEntries<T>(
  statements: FormlRuntimeNode[],
  values: Record<string, string>,
  entries: Record<string, T>,
): Record<string, T> {
  const limits = collectRepeatLimits(statements, values);
  if (limits.length === 0) return entries;

  return Object.fromEntries(Object.entries(entries).filter(([key]) => {
    for (const { baseName, count } of limits) {
      const match = key.match(new RegExp(`^${baseName}_repeat_(\\d+)(?:__.*)?$`));
      if (match) return Number(match[1]) < count;
    }
    return true;
  }));
}
