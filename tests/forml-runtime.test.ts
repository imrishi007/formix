import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { deriveComputedValues, formPageSteps, numericVariables, pruneInactiveRepeatEntries } from "../lib/forml-runtime";

const number = (value: number) => ({ type: "NumberLiteral", value });
const identifier = (name: string) => ({ type: "IdentifierExpr", name });
const binary = (operator: string, left: object, right: object) => ({
  type: "BinaryExpr", operator, left, right,
});

describe("Forml computed runtime", () => {
  it("evaluates arithmetic and includes the computed value in form data", () => {
    const fields = [{
      type: "Field",
      name: "total",
      fieldType: "float",
      compute: { expression: binary("*", identifier("quantity"), identifier("unit_price")) },
    }];
    assert.deepEqual(
      deriveComputedValues(fields, { quantity: "3", unit_price: "12.5" }),
      { total: "37.5" },
    );
  });

  it("supports numeric constants and chained computed fields", () => {
    const fields = [
      { type: "Field", name: "subtotal", compute: { expression: binary("*", identifier("quantity"), identifier("price")) } },
      { type: "Field", name: "total", compute: { expression: binary("+", identifier("subtotal"), identifier("fee")) } },
    ];
    assert.deepEqual(
      deriveComputedValues(fields, { quantity: "2", price: "10" }, { fee: 3 }),
      { subtotal: "20", total: "23" },
    );
  });

  it("does not produce a value for division by zero", () => {
    const fields = [{ type: "Field", name: "ratio", compute: { expression: binary("/", number(4), number(0)) } }];
    assert.deepEqual(deriveComputedValues(fields, {}), {});
  });

  it("reads numeric variables from the root AST", () => {
    assert.deepEqual(numericVariables({
      varDeclarations: [{ name: "tax", value: { valueKind: "number", numberValue: 0.18 } }],
    }), { tax: 0.18 });
  });

  it("removes hidden repeat answers when the respondent lowers the count", () => {
    const statements = [{
      type: "RepeatGroup",
      countRef: "book_count",
      fields: [{ name: "title" }, { name: "genres" }],
    }];
    const values = {
      book_count: "1",
      title_repeat_0: "Visible",
      title_repeat_1: "Removed",
      genres_repeat_1__Fiction: "true",
      unrelated: "keep",
    };
    assert.deepEqual(pruneInactiveRepeatEntries(statements, values, values), {
      book_count: "1",
      title_repeat_0: "Visible",
      unrelated: "keep",
    });
  });
});

describe("Forml page runtime", () => {
  it("creates real steps and keeps root fields on the first page", () => {
    const steps = formPageSteps({
      statements: [{ type: "Field", name: "application_id" }],
      pages: [
        { name: "Personal", statements: [{ type: "Field", name: "full_name" }] },
        { name: "Work", statements: [{ type: "Field", name: "organization" }] },
      ],
    });
    assert.deepEqual(steps.map((step) => ({
      name: step.name,
      fields: step.statements.map((field) => field.name),
    })), [
      { name: "Personal", fields: ["application_id", "full_name"] },
      { name: "Work", fields: ["organization"] },
    ]);
  });
});
