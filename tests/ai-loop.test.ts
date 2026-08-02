// tests/ai-loop.test.ts
//
// Unit tests for the compile-and-repair choreography (lib/ai-loop.ts). The
// loop takes `compile` and `streamTurn` as injected dependencies precisely so
// the whole repair dance can be exercised with fakes — no WASM, no network.
//
// Build + run:
//   npx tsc -p tests/tsconfig.json
//   node --test tests/.build/tests/ai-loop.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AiTurnError,
  MAX_REPAIR_ATTEMPTS,
  runRepairLoop,
} from "../lib/ai-loop";
import type { RepairLoopInput } from "../lib/ai-loop";
import type { AiChatEvent, AiChatRequestPayload } from "../lib/api";
import type { FormlCompileResult, FormlDiagnostic } from "../lib/use-forml-compiler";

// ── Fakes ─────────────────────────────────────────────────────────────────────

function err(message = "boom"): FormlDiagnostic {
  return { line: 1, col: 1, severity: "error", message };
}

function compileResult(diags: FormlDiagnostic[]): FormlCompileResult {
  return {
    ast: diags.length ? null : { type: "form" },
    diagnostics: diags,
    ok: diags.length === 0,
    durationMs: 1,
  };
}

/** One scripted turn: the SSE events it emits, plus a hook to inspect the
 *  request payload the loop sent (e.g. to assert on repair_context). */
interface TurnScript {
  events: AiChatEvent[];
  record?: (payload: AiChatRequestPayload) => void;
}

function makeStreamTurn(scripts: TurnScript[]) {
  let index = 0;
  return async (payload: AiChatRequestPayload, onEvent: (evt: AiChatEvent) => void) => {
    const script = scripts[index++];
    if (!script) throw new Error("streamTurn called more times than scripted");
    script.record?.(payload);
    for (const evt of script.events) onEvent(evt);
  };
}

/** Compile fake: `failWhen` decides per-source whether it errors. */
function makeCompile(failWhen: (src: string) => FormlDiagnostic[]) {
  const called: string[] = [];
  const fn = (src: string): FormlCompileResult => {
    called.push(src);
    return compileResult(failWhen(src));
  };
  return { fn, called };
}

function baseInput(overrides: Partial<RepairLoopInput> = {}): RepairLoopInput {
  return {
    formId: "form_1",
    userMessage: "Add an email field",
    source: "form Contact {}",
    diagnostics: [],
    selection: "",
    recentMessages: [],
    historySummary: "",
    compile: makeCompile(() => []).fn,
    streamTurn: makeStreamTurn([]),
    onDelta: () => {},
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runRepairLoop", () => {
  it("applies a clean revision in a single turn", async () => {
    const revised = "form Contact {\n  field email : email\n}";
    const deltas: string[] = [];
    const streamTurn = makeStreamTurn([
      {
        events: [
          { type: "delta", text: "Adding a field. " },
          { type: "result", explanation: "Adding a field.", revised_source: revised },
        ],
      },
    ]);
    const { fn: compile, called } = makeCompile(() => []);

    const outcome = await runRepairLoop(
      baseInput({ streamTurn, compile, onDelta: (t) => deltas.push(t) }),
    );

    assert.equal(outcome.ok, true);
    assert.equal(outcome.changed, true);
    assert.equal(outcome.attempts, 1);
    assert.equal(outcome.appliedSource, revised);
    assert.equal(outcome.explanation, "Adding a field.");
    assert.deepEqual(called, [revised]); // compiled exactly once, the result
    assert.deepEqual(deltas, ["Adding a field. "]); // deltas forwarded live
  });

  it("returns fast when the model made no edit (compile never runs)", async () => {
    const src = "form Contact {}";
    const streamTurn = makeStreamTurn([
      { events: [{ type: "result", explanation: "No changes needed.", revised_source: src }] },
    ]);
    const { fn: compile, called } = makeCompile(() => [err()]); // would fail if called

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, true);
    assert.equal(outcome.changed, false);
    assert.equal(outcome.appliedSource, src);
    assert.equal(outcome.attempts, 1);
    assert.deepEqual(called, []);
  });

  it("treats a conversational reply as a successful no-edit turn", async () => {
    // The assistant answers a question / doubt (revised_source: null) — this is
    // a normal chat turn, not a failure, and nothing is compiled or applied.
    const streamTurn = makeStreamTurn([
      {
        events: [
          { type: "delta", text: "Forml is a " },
          { type: "delta", text: "forms-as-code DSL." },
          { type: "result", explanation: "Forml is a forms-as-code DSL.", revised_source: null },
        ],
      },
    ]);
    const { fn: compile, called } = makeCompile(() => [err()]); // would fail if called

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, true);
    assert.equal(outcome.changed, false);
    assert.equal(outcome.revisedSource, null);
    assert.equal(outcome.appliedSource, null);
    assert.equal(outcome.attempts, 1);
    assert.equal(outcome.explanation, "Forml is a forms-as-code DSL.");
    assert.deepEqual(called, []); // conversational turns never hit the compiler
  });

  it("reports an unparseable initial reply", async () => {
    const streamTurn = makeStreamTurn([
      { events: [{ type: "delta", text: "thinking..." }] }, // never a result event
    ]);

    const outcome = await runRepairLoop(baseInput({ streamTurn }));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.failureReason, "unparseable");
    assert.equal(outcome.revisedSource, null);
    assert.equal(outcome.appliedSource, null);
    assert.equal(outcome.attempts, 1);
  });

  it("repairs once when the first revision fails to compile", async () => {
    const broken = "form Contact { BROKEN }";
    const fixed = "form Contact {\n  field email : email\n}";
    const repairs: AiChatRequestPayload[] = [];
    const streamTurn = makeStreamTurn([
      { events: [{ type: "result", explanation: "v1", revised_source: broken }] },
      {
        events: [{ type: "result", explanation: "fixed", revised_source: fixed }],
        record: (p) => repairs.push(p),
      },
    ]);
    const { fn: compile } = makeCompile((src) => (src === broken ? [err("unexpected token")] : []));

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, true);
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.appliedSource, fixed);

    // The repair turn carried the exact compiler errors + the broken source,
    // and nothing extraneous (user message is unused on repair turns).
    assert.equal(repairs.length, 1);
    assert.equal(repairs[0].source, broken);
    assert.deepEqual(repairs[0].diagnostics, []);
    assert.deepEqual(repairs[0].recent_messages, []);
    assert.equal(repairs[0].repair_context?.attempt, 1);
    assert.deepEqual(repairs[0].repair_context?.errors, [err("unexpected token")]);
  });

  it("stops after MAX_REPAIR_ATTEMPTS and never applies broken source", async () => {
    const broken = "form Contact { BROKEN }";
    const stillBroken = "form Contact { STILL BROKEN }";
    const lastBroken = "form Contact { NOPE }";
    const repairContexts: Array<{ attempt: number } | null | undefined> = [];
    const streamTurn = makeStreamTurn([
      { events: [{ type: "result", explanation: "v1", revised_source: broken }] },
      {
        events: [{ type: "result", explanation: "r1", revised_source: stillBroken }],
        record: (p) => repairContexts.push(p.repair_context),
      },
      {
        events: [{ type: "result", explanation: "r2", revised_source: lastBroken }],
        record: (p) => repairContexts.push(p.repair_context),
      },
    ]);
    const { fn: compile } = makeCompile(() => [err("syntax error")]);

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.attempts, MAX_REPAIR_ATTEMPTS + 1); // 1 initial + 2 repairs
    assert.equal(outcome.failureReason, "compile_failed");
    assert.equal(outcome.appliedSource, null);
    assert.equal(outcome.revisedSource, lastBroken);
    assert.ok(outcome.finalErrors.length > 0);

    // Attempt numbering is 1-based and strictly sequential.
    assert.equal(repairContexts[0]?.attempt, 1);
    assert.equal(repairContexts[1]?.attempt, 2);
  });

  it("keeps the broken source when a repair reply is itself unparseable", async () => {
    const broken = "form Contact { BROKEN }";
    const streamTurn = makeStreamTurn([
      { events: [{ type: "result", explanation: "v1", revised_source: broken }] },
      { events: [{ type: "delta", text: "hmm" }] }, // repair replies malformed
    ]);
    const { fn: compile } = makeCompile(() => [err()]);

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.failureReason, "unparseable");
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.revisedSource, broken);
    assert.equal(outcome.appliedSource, null);
    assert.ok(outcome.finalErrors.length > 0);
  });

  it("keeps the broken source when a repair reply is conversational (no source)", async () => {
    // A source-less reply to a fix request must never stand as the result —
    // the loop keeps the previous broken source and reports failure.
    const broken = "form Contact { BROKEN }";
    const streamTurn = makeStreamTurn([
      { events: [{ type: "result", explanation: "v1", revised_source: broken }] },
      { events: [{ type: "result", explanation: "I can explain what went wrong!", revised_source: null }] },
    ]);
    const { fn: compile } = makeCompile(() => [err()]);

    const outcome = await runRepairLoop(baseInput({ streamTurn, compile }));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.failureReason, "unparseable");
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.revisedSource, broken);
    assert.equal(outcome.appliedSource, null);
  });

  it("surfaces a server-side error event as AiTurnError(http)", async () => {
    const streamTurn = makeStreamTurn([
      { events: [{ type: "error", message: "Formix AI is not configured" }] },
    ]);

    await assert.rejects(
      runRepairLoop(baseInput({ streamTurn })),
      (e: unknown) => e instanceof AiTurnError && e.reason === "http",
    );
  });

  it("guards the repair choreography constant", () => {
    assert.equal(MAX_REPAIR_ATTEMPTS, 2);
  });
});
