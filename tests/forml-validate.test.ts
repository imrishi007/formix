import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateField } from "../lib/forml-validate";

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
