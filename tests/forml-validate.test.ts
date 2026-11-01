import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateField, validateForm } from "../lib/forml-validate";

const website = {
  name: "website",
  fieldType: "url",
  ui: { label: "Website" },
};

describe("URL field validation", () => {
  it("accepts web addresses with or without a scheme", () => {
    assert.equal(validateField(website, "website", { website: "example.com" }), null);
    assert.equal(validateField(website, "website", { website: "https://example.com/path" }), null);
  });

  it("rejects malformed web addresses", () => {
    assert.match(
      validateField(website, "website", { website: "not a website" }) ?? "",
      /valid web address/,
    );
  });
});

describe("conditional validation", () => {
  const statements = [{
    type: "Conditional",
    condition: {
      type: "SimpleCond",
      field: "age",
      comparator: ">=",
      value: { valueKind: "number", numberValue: 18 },
    },
    then: [{ type: "Field", name: "occupation", fieldType: "text" }],
    else: [{
      type: "Field",
      name: "guardian_name",
      fieldType: "text",
      validation: { required: true },
    }],
  }];

  it("does not validate a hidden required else field", () => {
    assert.deepEqual(validateForm(statements, { age: "21" }), {});
  });

  it("validates the required field when its branch is visible", () => {
    assert.deepEqual(validateForm(statements, { age: "15" }), {
      guardian_name: "guardian_name is required.",
    });
  });
});
