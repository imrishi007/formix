// tests/forml-diff.test.ts
//
// Unit tests for the client-side line diff (lib/forml-diff.ts). These run the
// same diff the AI panel renders, so a regression in line-number gutters or
// change stats fails here first.
//
// Build + run:
//   npx tsc -p tests/tsconfig.json
//   node --test tests/.build/tests/forml-diff.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { diffLines, diffStats, hasChanges } from "../lib/forml-diff";

describe("diffLines", () => {
  it("returns only unchanged lines (and zero stats) for identical sources", () => {
    const src = "form Contact {\n  field name : text\n}";
    const lines = diffLines(src, src);
    assert.ok(lines.length > 0);
    assert.ok(lines.every((l) => l.type === "unchanged"));
    assert.deepEqual(diffStats(src, src), { added: 0, removed: 0 });
    assert.equal(hasChanges(src, src), false);
  });

  it("marks an inserted line as an add with only a newLine", () => {
    const oldSrc = "a\nb\nc";
    const newSrc = "a\nb\nB\nc";
    const lines = diffLines(oldSrc, newSrc);

    const added = lines.filter((l) => l.type === "add");
    assert.equal(added.length, 1);
    assert.equal(added[0].content, "B");
    assert.equal(added[0].newLine, 3);
    assert.equal(added[0].oldLine, null);
    assert.equal(diffStats(oldSrc, newSrc).added, 1);
    assert.equal(diffStats(oldSrc, newSrc).removed, 0);
  });

  it("marks a removed line with only an oldLine", () => {
    const oldSrc = "a\nb\nc";
    const newSrc = "a\nc";
    const lines = diffLines(oldSrc, newSrc);

    const removed = lines.filter((l) => l.type === "remove");
    assert.equal(removed.length, 1);
    assert.equal(removed[0].content, "b");
    assert.equal(removed[0].oldLine, 2);
    assert.equal(removed[0].newLine, null);
    assert.equal(diffStats(oldSrc, newSrc).removed, 1);
  });

  it("tracks old and new line numbers across a replacement", () => {
    const oldSrc = "a\nb\nc\nd";
    const newSrc = "a\nB\nc\nd";
    const lines = diffLines(oldSrc, newSrc);

    const remove = lines.find((l) => l.type === "remove")!;
    const add = lines.find((l) => l.type === "add")!;
    assert.equal(remove.content, "b");
    assert.equal(remove.oldLine, 2);
    assert.equal(add.content, "B");
    assert.equal(add.newLine, 2);

    // The unchanged "c" advanced past the changed hunk on both sides.
    const unchanged = lines.filter((l) => l.type === "unchanged");
    assert.ok(unchanged.some((l) => l.content === "c" && l.oldLine === 3 && l.newLine === 3));
  });

  it("keeps subsequent line numbers aligned after edits (not just per-hunk)", () => {
    const oldSrc = "1\n2\n3\n4\n5";
    const newSrc = "1\n2\nX\n3\n4\n5";
    const lines = diffLines(oldSrc, newSrc);
    const changedCount = lines.filter((l) => l.type !== "unchanged").length;
    assert.equal(changedCount, 1); // only the inserted line counts as a change

    // Trailing unchanged lines are 5/6 in old/new numbering respectively.
    const five = lines.filter((l) => l.type === "unchanged").at(-1)!;
    assert.equal(five.content, "5");
    assert.equal(five.oldLine, 5);
    assert.equal(five.newLine, 6);
  });

  it("handles an appended final line when neither source ends in a newline", () => {
    const lines = diffLines("line one\nline two", "line one\nline two\nline three");
    const adds = lines.filter((l) => l.type === "add");
    assert.equal(adds.length, 1);
    assert.equal(adds[0].content, "line three");
    assert.equal(adds[0].newLine, 3);
  });

  it("ignores a trailing-newline-only difference", () => {
    // Same lines, one source ends "\n" and the other does not → no real change.
    const a = "line one\nline two";
    const b = "line one\nline two\n";
    const lines = diffLines(a, b);
    assert.ok(lines.length > 0);
    assert.ok(lines.every((l) => l.type === "unchanged"));
    assert.equal(hasChanges(a, b), false);
  });
});

describe("hasChanges", () => {
  it("is false only when the sources are identical (ignoring a trailing newline)", () => {
    assert.equal(hasChanges("a\nb", "a\nb"), false);
    assert.equal(hasChanges("a\nb", "a\nb\n"), false);
    assert.equal(hasChanges("a", "b"), true);
  });
});
