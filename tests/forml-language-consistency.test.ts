import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HOVER_DOCS, SNIPPETS } from "../lib/monaco-forml-language";

describe("Forml editor language guidance", () => {
  it("inserts the compiler's canonical repeat and compute syntax", () => {
    assert.match(SNIPPETS.repeat.insert, /repeat count =/);
    assert.match(SNIPPETS.compute.insert, /field .* : float compute =/);
    assert.doesNotMatch(SNIPPETS.repeat.insert, /count:/);
    assert.doesNotMatch(SNIPPETS.compute.insert, / from /);
  });

  it("inserts canonical actions and function-call trigger statements", () => {
    assert.match(SNIPPETS["action submit"].insert, /^action submit \{/);
    assert.match(SNIPPETS["on change"].insert, /hide.*\(.*\)/);
    assert.match(SNIPPETS["on blur"].insert, /set.*\(.*,.*\)/);
  });

  it("teaches scheme-optional website input", () => {
    assert.match(HOVER_DOCS.url, /example\.com/);
  });
});
