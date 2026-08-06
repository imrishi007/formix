"""
backend/routers/ai.py
LLM-backed Formix AI chat endpoint.

Replaces the rule-based generator in the frontend (lib/ai-engine.ts) with a real
LLM call. This router:

  - embeds the canonical Forml EBNF grammar (forml-compiler/EBNF_grammar.md)
    into the system prompt on EVERY request, so the model never invents syntax
  - is a two-mode assistant: CONVERSATION (`{"explanation": ...}` — questions,
    doubts, teaching) and EDITING (`{"explanation", "revisedSource"}`), with the
    model choosing the shape per turn (see _parse_strict). An edit request is
    expected to return BOTH in one reply (the model talks AND does the work);
    the system prompt biases hard against reply-with-question-only turns
  - treats every configured provider as an ordered failover chain
    (_all_configs): if the primary provider's free-tier quota is spent for the
    day (Gemini caps ~20 req/day/model — see _is_quota_exhausted), the same
    turn is retried on the next provider (e.g. a configured Groq key) instead
    of erroring out, so the AI keeps creating/editing forms when a quota resets
  - streams the explanation to the client token-by-token (SSE) while the
    full reply is still being generated
  - validates the complete reply (tolerating fences, surrounding prose, and
    repairing the classic model mistakes — literal newlines, unescaped quotes,
    trailing commas), and on any remaining deviation makes ONE corrective retry
    before giving up with an error event; a reply truncated at the token limit
    (finish_reason "length") is detected and retried with a truncation-specific
    instruction; repair turns (repair_context) still require a full revised
    source so a broken form is never silently accepted
  - persists the conversation per form server-side (last HISTORY_CAP messages),
    since the frontend's localStorage history is being replaced by this

The client-side compile-and-repair loop (lib/ai-loop.ts) is separate from this
router: the client compiles `revisedSource` with its WASM compiler and, on
failure, POSTs a repair turn carrying the exact diagnostics in repair_context.

Routes (all auth-guarded, all scoped to a form the current user owns):
  POST   /ai/forms/{form_id}/chat     — run one chat turn, SSE stream
  GET    /ai/forms/{form_id}/history  — full persisted history
  POST   /ai/forms/{form_id}/messages — append a resolved turn (user + assistant)
  DELETE /ai/forms/{form_id}/messages — clear history for the form
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..deps import get_form_or_403
from ..models import AiChatMessage, Form, Project, Submission, User
from ..schemas import AiAppendRequest, AiAppendResponse, AiChatHistoryResponse, AiChatRequest

logger = logging.getLogger("formix.ai")

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Configuration ──────────────────────────────────────────────────────────────

# How many messages (user + assistant) to keep per form on the server. The
# client only ever sends the last 5-6 verbatim plus a one-line summary of older
# history, so this cap bounds storage while comfortably covering any realistic
# follow-up window.
HISTORY_CAP = 20

# OpenAI-compatible provider configuration, driven entirely by the environment
# so ANY provider that speaks the /chat/completions protocol (Gemini, Groq,
# Cerebras, OpenRouter, a local Ollama instance...) plugs in without code
# changes:
#
#   AI_API_KEY  (+ AI_BASE_URL / AI_MODEL / AI_TEMPERATURE / AI_MAX_TOKENS)
#                 -> Gemini by default (generous, no-card free tier)
#   GEMINI_API_KEY -> Gemini, Google AI Studio's preferred spelling (same
#                     defaults as AI_API_KEY, so either works)
#   GROQ_API_KEY (+ GROQ_* variables, legacy)
#                 -> Groq
#
# The providers are treated as an ordered FAILOVER CHAIN, not a single pick:
# _all_configs() enumerates every configured provider high-priority-first, and
# the transport retries the same turn on the next provider when the current one
# is unavailable. This matters because Gemini's free tier caps a model at ~20
# requests/day (see _is_quota_exhausted) — once that quota is spent, retrying
# can never clear it, but the configured Groq key usually still works. So a
# chat turn that hits a spent Gemini quota transparently continues on Groq
# instead of surfacing an error. The configs are read lazily at request time,
# so swapping providers is an env change (restart the server), not a code change.
DEFAULT_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
DEFAULT_AI_MODEL = "gemini-3.6-flash"
DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
# llama-3.3-70b-versatile is the strongest STABLE model on Groq's free tier.
# The other options measured live on this org are all worse: llama-3.1-8b-
# instant caps at 6K TPM, gpt-oss-20b/120b at 8K TPM, and groq/compound's
# nominal 70K TPM is misleading — it is a ROUTER that fans out to sub-models
# (llama-4-scout, gpt-oss-120b) each with their own tiny pools, and it hard-
# rejects non-streaming requests over ~3.3K tokens with a 413, which breaks
# the corrective-fixup path. 70b's 12K TPM is the largest pool that works on
# BOTH the streaming and non-streaming paths, and it demonstrably generated a
# correct form when the pool was idle. Its 413 "tokens per minute" rejections
# are transient — the per-minute bucket refills — so the transports back off
# and retry them (see _is_tpm_limit) rather than erroring out.
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

# Default output-token budget. This was 4096 and is now 8192 because an edit
# turn embeds the ENTIRE revised .forml source in one JSON string — a form with
# a few fields and validation rules can easily approach 4096 tokens, and a reply
# that hits the cap mid-JSON is unparseable (see TRUNCATION_INSTRUCTION).
# 8192 is the safe ceiling for both Gemini flash and Groq's llama-3.3-70b.

# 429 rate-limit handling. Both free tiers throttle per minute, and a burst of
# chat turns will hit it; retry up to this many times, honouring the provider's
# Retry-After / reset headers (see _retry_after).
MAX_AI_RETRIES = 3

# Path to the canonical grammar. resolved relative to this file so it works no
# matter where uvicorn is launched from: backend/routers/ai.py -> repo root ->
# forml-compiler/EBNF_grammar.md
_GRAMMAR_PATH = Path(__file__).resolve().parents[2] / "forml-compiler" / "EBNF_grammar.md"

# The backend/.env file, resolved relative to this file: backend/routers/ai.py
# -> parents[1] == backend/.
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def _refresh_env() -> None:
    """Re-read backend/.env so a key swap takes effect WITHOUT a restart.

    backend/main.py calls load_dotenv exactly once at import time, so a running
    `uvicorn --reload` server keeps serving the OLD key (and its exhausted /
    saturated rate-limit pools) until it is restarted — the "I added a new GROQ
    key but still get 413" trap. The provider chain reads the environment on
    EVERY request, so re-loading the file here makes an edited GROQ_API_KEY (or
    a newly added provider block) live the moment the file changes.

    `override=True` lets the .env value win over a stale value the process was
    started with — in dev that is the whole point of editing .env. In
    production there is no .env file (Render sets env vars directly), so this
    call is a no-op there. Reading a ~1KB file per request is negligible.
    """
    try:
        from dotenv import load_dotenv

        load_dotenv(_ENV_FILE, override=True)
    except ImportError:
        pass  # python-dotenv absent (pre pip install -r requirements.txt)


def _all_configs() -> list[dict]:
    """Every configured provider, highest priority first.

    This is the whole failover chain, not just the top pick:

      1. AI_API_KEY set     -> AI_* variables (Gemini defaults)
      2. GEMINI_API_KEY set -> Gemini defaults (shortcut for Google AI Studio)
      3. GROQ_API_KEY set   -> GROQ_* variables (legacy Groq)

    Duplicates (same base URL + key) are collapsed so the transport never
    retries the same quota twice. Each entry is
    {"base_url", "model", "api_key", "temperature", "max_tokens"}. Empty when
    no key is configured at all (callers surface a friendly error).
    """
    _refresh_env()
    configs: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def _add(base_url: str, model: str, api_key: str, temperature: float, max_tokens: int) -> None:
        key = (base_url, api_key)
        if key in seen:
            return
        seen.add(key)
        configs.append(
            {
                "base_url": base_url,
                "model": model,
                "api_key": api_key,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )

    # The GEMINI_API_KEY entry shares the AI_* overrides (a custom AI_BASE_URL /
    # AI_MODEL applies to whichever Gemini-flavoured key is in play).
    ai_base = os.environ.get("AI_BASE_URL", "").strip() or DEFAULT_AI_BASE_URL
    ai_model = os.environ.get("AI_MODEL", "").strip() or DEFAULT_AI_MODEL
    ai_temp = float(os.environ.get("AI_TEMPERATURE", "0.3"))
    ai_max = int(os.environ.get("AI_MAX_TOKENS", "8192"))

    ai_key = os.environ.get("AI_API_KEY", "").strip()
    if ai_key:
        _add(ai_base, ai_model, ai_key, ai_temp, ai_max)

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key:
        _add(ai_base, ai_model, gemini_key, ai_temp, ai_max)

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        _add(
            os.environ.get("GROQ_BASE_URL", "").strip() or DEFAULT_GROQ_BASE_URL,
            os.environ.get("GROQ_MODEL", "").strip() or DEFAULT_GROQ_MODEL,
            groq_key,
            float(os.environ.get("GROQ_TEMPERATURE", "0.3")),
            int(os.environ.get("GROQ_MAX_TOKENS", "8192")),
        )

    return configs


def _active_config() -> dict | None:
    """The single highest-priority provider config, or None.

    Kept for callers that only want the primary pick; the transports use
    _all_configs() so they can fail over to a secondary provider."""
    configs = _all_configs()
    return configs[0] if configs else None


# ── Grammar + system prompt ────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_grammar() -> str:
    """Read the canonical EBNF grammar text once and cache it.

    This file is the single source of truth for valid Forml syntax (per
    AGENTS.md), so it is embedded verbatim into the system prompt rather than
    summarized — the model is allowed to derive structure ONLY from it.
    """
    if not _GRAMMAR_PATH.exists():
        logger.error("Grammar file missing at %s", _GRAMMAR_PATH)
        return "(grammar file not found)"
    return _GRAMMAR_PATH.read_text(encoding="utf-8")


def _system_prompt() -> str:
    """Build the system prompt for one LLM request.

    The EBNF grammar is included on EVERY request so the model re-grounds itself
    in the actual syntax (not whatever it remembers about similar DSLs) — this
    is what makes the compile-and-repair loop converge instead of guessing.

    The prompt deliberately supports TWO kinds of turns so the assistant reads
    as a real chatbot and not a form-only tool:
      - CONVERSATION: answering questions / doubts / teaching. The reply is
        `{"explanation": ...}` only — no revisedSource, no echoing the source.
      - EDITING: producing a full revised `.forml` source in `revisedSource`.
    """
    grammar = _load_grammar()
    return f"""You are Formix AI, a friendly and knowledgeable assistant for Forml — the Forms-as-Code DSL the Formix product is built on. You do two things:

1. CONVERSATION: users ask questions, doubts, and for help learning. They may ask about Forml syntax, the EBNF grammar below, how the compiler works, form design and validation, or forms in general. Answer warmly and as thoroughly as the question deserves. You may use markdown in your reply — lists, **bold**, `inline code`, and fenced code blocks for short examples.

2. EDITING: when the user asks you to create, change, or fix the form in the editor, you write valid Forml. When editing, preserve every untouched part of the current source EXACTLY — same lines, same indentation, same comments — and keep the explanation brief (2-5 sentences), because the user sees a line diff of exactly what changed.

The ONLY valid Forml syntax is defined by the EBNF grammar below. It is the sole syntax authority. NEVER invent fields, keys, blocks, or constructs that are not present in it. The current source, any selected code, and the latest compiler diagnostics are given as context — use them.

You are also given the author's account context (their profile, form catalog with submission counts, and totals) on every turn. Users may ask account questions from it — "how many forms do I have?", "find my contact form", "what are the stats of form X?" — and you answer from that data. NEVER invent or describe forms, numbers, or stats that are not listed there; if the catalog is empty or a form is not listed, say so truthfully.

<EBNF_GRAMMAR>
{grammar}
</EBNF_GRAMMAR>

Rules:
1. When the user asks you to create, change, or fix a form, ALWAYS produce the complete revised .forml source in the SAME turn — never reply with a clarifying question alone, and never answer with explanation only. If the request leaves details unspecified, make reasonable choices (sensible field types, labels, validation, and a submit action) and briefly note your assumptions in the explanation, inviting the user to refine. The explanation and the code are ONE reply: you both talk and do the work, like a pair-programmer.
2. When editing, ALWAYS return the FULL revised .forml source — never a diff, never a partial patch, never ellipses, never a description of the change instead of the source itself.
3. Only include revisedSource when the source actually changed. For pure conversation (a question, a doubt, an explanation request), do NOT echo the source back.

Response format:
Respond with a single JSON object and NOTHING else — no markdown fences around the JSON, no commentary outside it. Choose the shape that matches the turn:
- {{"explanation": "..."}} — a conversational answer or a clarifying question. No source change.
- {{"explanation": "...", "revisedSource": "..."}} — an edit: the ENTIRE revised .forml source.

"explanation" is always your reply to the user. Escape newlines, quotes, and backslashes exactly as JSON requires."""


# ── Streaming JSON extraction ─────────────────────────────────────────────────

class _KeyState:
    """Per-key scan state for StreamingJsonScanner (one small object per key).

    Kept as a plain class (not dataclass) so the hot path stays allocation-free.
    Fields:
      search_from : buffer index to resume searching for the key token from
      key_pos     : index of the '"key"' token once found (-1 until then)
      colon       : index of the ':' after the key (-1 until found)
      open_quote  : index of the opening quote of the value (-1 until found)
      scan        : cursor currently walking the string value
      emitted     : how far into the value has already been handed out
      closed      : True once the closing quote is seen
      value       : raw (still JSON-escaped) value, including escapes
    """
    __slots__ = ("search_from", "key_pos", "colon", "open_quote", "scan", "emitted", "closed", "value")

    def __init__(self):
        self.search_from = 0
        self.key_pos = -1
        self.colon = -1
        self.open_quote = -1
        self.scan = -1
        self.emitted = -1
        self.closed = False
        self.value = ""


class StreamingJsonScanner:
    """Incrementally pull a named string field out of a JSON object as its
    characters arrive over an SSE/streaming reply.

    The model's reply is tiny but streamed, and we want to forward the
    `explanation` text to the client in near-real time rather than buffering the
    whole reply first. This scanner re-walks the accumulated buffer on each
    chunk (cheap for ~KB-scale replies) and emits only the newly-available
    decoded characters of the requested key.

    Correctness notes:
      - honors backslash escapes while scanning, so quotes/newlines inside the
        value don't terminate it early
      - holds back a trailing backslash (an escape sequence split across two
        chunks) so it is never decoded alone
      - emits DELTAS as unescaped text (feed returns {key: newlyDecodedChars})
      - exposes .value(key) as the RAW escaped string; json.loads() decodes it
    """

    def __init__(self, keys):
        self._keys = keys
        self._states = {k: _KeyState() for k in keys}
        self._buf = ""

    def feed(self, chunk: str) -> dict:
        """Append a streamed chunk and return newly available decoded text,
        keyed by the requested key name. Returns {} when nothing new yet."""
        self._buf += chunk
        out = {}
        for key in self._keys:
            delta = self._scan(key)
            if delta:
                out[key] = out.get(key, "") + delta
        return out

    def _scan(self, key: str) -> str:
        st = self._states[key]
        buf = self._buf

        # 1) Find the '"key"' token. Search from 0 until found (buffer is tiny,
        # and this guarantees we never skip over a key that appears later).
        if st.key_pos < 0:
            pos = buf.find('"' + key + '"', st.search_from)
            if pos < 0:
                st.search_from = max(0, len(buf) - len(key) - 4)
                return ""
            st.key_pos = pos
            st.search_from = pos + len(key) + 2

        # 2) Find the ':' that follows the key token.
        if st.colon < 0:
            colon = buf.find(":", st.key_pos + len(key) + 2)
            if colon < 0:
                return ""
            st.colon = colon

        # 3) Find the opening quote of the value.
        if st.open_quote < 0:
            oq = buf.find('"', st.colon + 1)
            if oq < 0:
                return ""
            st.open_quote = oq
            st.scan = oq + 1
            st.emitted = oq + 1

        # 4) Walk the string value honoring escapes. `end` is the closing quote
        #    index once the value is complete.
        i = st.scan
        end = None
        while i < len(buf):
            ch = buf[i]
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                end = i
                break
            i += 1

        emit_until = min(i if end is None else end, len(buf))
        if emit_until <= st.emitted:
            if end is not None:
                st.closed = True
                st.value = buf[st.open_quote + 1:end]
            return ""

        delta = buf[st.emitted:emit_until]
        if delta.endswith("\\") and end is None:
            # A backslash is the first half of an escape sequence that may be
            # completed by the next chunk — don't decode it in isolation.
            delta = delta[:-1]
            emit_until -= 1
            if emit_until <= st.emitted:
                return ""

        st.emitted = emit_until
        if end is not None:
            st.closed = True
            st.value = buf[st.open_quote + 1:end]
        else:
            st.value += delta

        try:
            return json.loads('"' + delta + '"')
        except json.JSONDecodeError:
            # Shouldn't happen after the trailing-backslash guard, but never let
            # a malformed escape kill the stream.
            return delta

    def is_closed(self, key: str) -> bool:
        return self._states[key].closed

    def value(self, key: str) -> str:
        """Return the RAW (still JSON-escaped) value for a key."""
        return self._states[key].value


def _repair_candidates(text: str, max_candidates: int = 64) -> list[str]:
    """Generate candidate repaired-JSON strings for `text`, most-likely first.

    Real models — Gemini especially — emit replies that `json.loads` rejects for
    a handful of reproducible reasons:

      - literal newlines / tabs / control characters inside string values
        instead of the `\\n` / `\\t` / `\\uXXXX` escapes JSON requires
      - unescaped double quotes inside string values (a Forml label like
        `label "GATE Score"` ends up inside `revisedSource`, and the model
        forgets to escape the quotes around the label)
      - trailing commas before `}` or `]`
      - a string left open because the reply was cut off a hair too early

    The first three are fixed by a deterministic left-to-right walk that tracks
    one fact: am I inside a string value? The genuinely ambiguous decision is
    whether a `"` inside a string is the REAL closing quote or an unescaped
    inner quote. A single-pass heuristic can't tell (an inner quote in `"GATE
    Score", as requested` looks exactly like a closing quote), so we BRANCH on
    both interpretations and let a full json.loads pick the winner: the correct
    close is the one after which the rest of the document still parses, so
    wrong branches die fast. Branches are capped so a pathological reply can't
    explode.

    Within a string: backslash escapes are copied verbatim (the model may have
    escaped correctly in places); an unambiguous inner quote (next char is
    anything but a JSON continuation) becomes `\\"`; a literal newline/tab/CR/
    control char becomes its escape sequence. Outside a string: a `,` followed
    by `}`/`]` is a trailing comma and is dropped. A string still open at end
    of input is closed with a quote.
    """
    results: list[str] = []

    def walk(i: int, in_string: bool, out: list[str]) -> None:
        if len(results) >= max_candidates:
            return
        n = len(text)
        while i < n:
            if len(results) >= max_candidates:
                return
            ch = text[i]
            if in_string:
                if ch == "\\":
                    out.append(ch)
                    if i + 1 < n:
                        out.append(text[i + 1])
                        i += 2
                    else:
                        i += 1
                    continue
                if ch == '"':
                    j = i + 1
                    while j < n and text[j] in " \t\r\n":
                        j += 1
                    nxt = text[j] if j < n else ""
                    if nxt in (",", "}", "]", ":", ""):
                        # Ambiguous. Branch both ways, close-interpretation
                        # first (it fails fast when wrong because the next
                        # tokens won't form valid JSON). The escape branch
                        # keeps the string open past this quote.
                        branch_close = out.copy()
                        branch_close.append(ch)
                        walk(i + 1, False, branch_close)
                        branch_escape = out.copy()
                        branch_escape.append('\\"')
                        walk(i + 1, True, branch_escape)
                        return
                    out.append('\\"')  # unambiguously an inner quote
                    i += 1
                    continue
                if ch == "\n":
                    out.append("\\n")
                    i += 1
                    continue
                if ch == "\r":
                    if i + 1 < n and text[i + 1] == "\n":
                        out.append("\\n")
                        i += 2
                    else:
                        out.append("\\r")
                        i += 1
                    continue
                if ch == "\t":
                    out.append("\\t")
                    i += 1
                    continue
                if ord(ch) < 0x20:  # any other unescaped control character
                    out.append(f"\\u{ord(ch):04x}")
                    i += 1
                    continue
                out.append(ch)
                i += 1
                continue
            # Outside a string.
            if ch == '"':
                out.append(ch)
                i += 1
                in_string = True
                continue
            if ch == ",":
                j = i + 1
                while j < n and text[j] in " \t\r\n":
                    j += 1
                if j < n and text[j] in "}]":
                    i += 1  # trailing comma — drop it
                    continue
            out.append(ch)
            i += 1
        if in_string:
            out.append('"')  # unterminated string at end of input — close it
        results.append("".join(out))

    walk(0, False, [])
    return results


def _extract_fenced_blocks(text: str) -> list[str]:
    """Return the contents of every markdown fenced code block (```...```) in
    the text. Models wrap the JSON in a fence despite being told not to; taking
    ALL fences (not just the first) survives the case where the explanation
    string itself also contains an example fence that would otherwise be
    misidentified as the reply. Bad candidates are simply skipped later."""
    blocks: list[str] = []
    for match in re.finditer(r"```[a-zA-Z0-9_+-]*\s*\n?(.*?)\n?```", text, re.DOTALL):
        content = match.group(1).strip()
        if content:
            blocks.append(content)
    return blocks


def _balanced_spans(text: str, limit: int = 16) -> list[str]:
    """Return the text of each complete top-level `{...}` object in `text`.

    A single left-to-right scan tracks whether we are inside a string (honoring
    backslash escapes) so braces that live inside string values — a Forml source
    inside `revisedSource`, a code example inside `explanation` — never confuse
    the matcher. Prose before/after the JSON is simply skipped, which is exactly
    the "Here is the JSON:" + trailing commentary pattern. Capped at `limit`
    candidates so a pathological reply can't turn the later parse attempts into
    O(n^2)."""
    spans: list[str] = []
    stack: list[int] = []
    in_string = False
    i, n = 0, len(text)
    while i < n and len(spans) < limit:
        ch = text[i]
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            stack.append(i)
        elif ch == "}":
            if stack:
                start = stack.pop()
                if not stack:  # a complete top-level object — capture it
                    spans.append(text[start:i + 1])
        i += 1
    return spans


def _loads_lenient(text: str) -> list:
    """json.loads strict first, then every repaired candidate.

    Returns the list of successfully parsed objects (usually 0 or 1; the repair
    branching in _repair_candidates can yield several). Strict success short-
    circuits: valid JSON needs no repair, and the shape check below decides
    whether it's acceptable."""
    try:
        return [json.loads(text)]
    except (json.JSONDecodeError, ValueError):
        pass
    results: list = []
    for candidate in _repair_candidates(text):
        try:
            results.append(json.loads(candidate))
        except (json.JSONDecodeError, ValueError):
            continue
    # Dedupe identical objects — several repair branches converge on the same
    # shape, and callers only need each interpretation once.
    deduped: list = []
    seen: set[str] = set()
    for obj in results:
        key = json.dumps(obj, sort_keys=True)
        if key not in seen:
            seen.add(key)
            deduped.append(obj)
    return deduped


def _summarize_raw(raw: str, limit: int = 8000) -> str:
    """Raw reply for the logs: full text when short, a cut-down version with an
    explicit truncation note when long (so one bad reply can't flood Render's
    log stream)."""
    if len(raw) <= limit:
        return raw
    return f"{raw[:limit]}... [log truncated {len(raw) - limit} more chars]"


def _parse_strict(raw: str):
    """Parse the model's reply into the accepted response shapes.

    Returns a dict with "explanation" (str) and, for edit turns, "revisedSource"
    (str), or None. Two shapes are valid:
      - {"explanation": "..."}                  — conversational turn
      - {"explanation": "...", "revisedSource": "..."} — edit turn

    Tolerates, in order of preference:
      1. pure JSON
      2. JSON wrapped in markdown fences (any number, so an example fence
         inside the explanation can't be mistaken for the reply)
      3. JSON embedded in surrounding prose (balanced-brace scan that ignores
         braces inside strings)
      4. on top of all of the above, a lenient repair of the classic model
         mistakes — literal newlines, unescaped quotes and trailing commas (see
         _repair_candidates). Anything else is a shape violation and triggers
         the corrective retry.
    """
    text = (raw or "").strip()
    candidates: list[str] = []
    if text:
        candidates.append(text)
    candidates.extend(_extract_fenced_blocks(text))
    candidates.extend(_balanced_spans(text))

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        # Every repair interpretation is a candidate: a wrong branch may parse
        # as valid JSON, so the shape check must run on each of them, not just
        # the first parse.
        for obj in _loads_lenient(candidate):
            if not isinstance(obj, dict):
                continue
            # "explanation" is mandatory in both shapes.
            if not isinstance(obj.get("explanation"), str):
                continue
            # "revisedSource" is optional (conversational) but, when present,
            # must be a string (an edit). Numbers/objects/etc. are shape
            # violations.
            rs = obj.get("revisedSource")
            if rs is None or isinstance(rs, str):
                return obj
    return None


FIXUP_INSTRUCTION = (
    "Your previous reply could not be parsed as the required JSON object. "
    "Reply with EXACTLY a single JSON object — no markdown fences, no code "
    "blocks, no trailing commentary, no text outside the JSON. Use ONE of these "
    "two shapes, matching the turn: "
    '{"explanation": "..."} for a conversational answer (no source change), or '
    '{"explanation": "...", "revisedSource": "..."} when editing the form. '
    "Make sure every quote, backslash, and newline inside the strings is "
    "properly JSON-escaped."
)

TRUNCATION_INSTRUCTION = (
    "Your previous reply was cut off before it finished — the output hit the "
    "maximum token limit while the JSON object was still incomplete, so it "
    "could not be parsed. Reply again with EXACTLY a single JSON object — no "
    "markdown fences, no code blocks, no text outside the JSON — using one of "
    "these two shapes, matching the turn: "
    '{"explanation": "..."} or {"explanation": "...", "revisedSource": "..."}. '
    "The revisedSource may be long, so keep the explanation to ONE short "
    "sentence so the whole reply fits in the token budget."
)


# ── Provider transport (module-level for testability) ─────────────────────────

def _headers(cfg: dict) -> dict:
    return {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}


def _request_body(cfg: dict, messages: list[dict], *, stream: bool) -> dict:
    """Build the OpenAI-compatible /chat/completions request body."""
    body = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": cfg["temperature"],
        "max_tokens": cfg["max_tokens"],
        "stream": stream,
        "response_format": {"type": "json_object"},
    }
    # Gemini flash models "think" by default, which burns output tokens and
    # delays the first streamed token. This is a form-editor chat: the reasoning
    # is never shown to the user, so ask for the *minimum* thinking level to keep
    # replies fast and inside the free-tier token budget. (2.5-era models could
    # disable thinking entirely with "none", but reasoning cannot be turned off
    # for Gemini 3.x models — "minimal" is the cheapest legal value.)
    if "generativelanguage" in cfg["base_url"]:
        body["reasoning_effort"] = "minimal"
    return body


def _retry_after(resp) -> float:
    """Seconds to wait before retrying after a 429, honouring Retry-After.

    Falls back to the provider's reset headers (e.g. Groq's
    `x-ratelimit-reset-tokens: 2m5.5s`) and then a conservative default.
    """
    header = resp.headers.get("Retry-After")
    if header:
        try:
            return max(0.0, float(header))
        except ValueError:
            return 5.0  # HTTP-date form; not worth parsing here
    for key in ("x-ratelimit-reset-tokens", "x-ratelimit-reset-tokens-minute"):
        value = resp.headers.get(key)
        if value:
            match = re.match(r"(?:(\d+)m)?([\d.]+)s", value)
            if match:
                return int(match.group(1) or 0) * 60 + float(match.group(2))
    return 5.0


def _missing_key_message() -> str:
    return "server is missing AI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY"


# HTTP statuses that mean "this provider is having a moment" and it is worth
# trying the next provider in the chain. 4xx client errors (400 malformed
# request, 404 bad route) mean OUR request is wrong and would fail identically
# on every provider, so they raise without burning the fallback. 401/403 are
# included because a bad/revoked key on one provider is a common real-world
# state that a valid key on another provider will happily serve through. 413
# (request too large) is included because it is provider-SPECIFIC: a request
# that Groq's 12K-TPM free tier rejects as oversized (see DEFAULT_GROQ_MODEL)
# fits comfortably in another provider's far larger context window.
_PROVIDER_TRANSIENT_STATUSES = {401, 403, 413, 429, 500, 502, 503, 504}


def _should_fail_over(status_code: int) -> bool:
    """True when a provider error is worth retrying on the next provider."""
    return status_code in _PROVIDER_TRANSIENT_STATUSES


def _is_quota_exhausted(resp) -> bool:
    """True when a 429 body is a HARD quota exhaustion, not a per-minute rate
    limit.

    Google's spent-quota replies carry status `RESOURCE_EXHAUSTED` and a
    "You exceeded your current quota" message — the free tier caps a model at
    ~20 requests/day, and once spent, no number of retries within a sane
    window will clear it. That is a fail-over trigger, not a retry trigger.
    A plain per-minute rate limit, by contrast, clears after Retry-After.
    """
    text = (resp.text or "").lower()
    return (
        "resource_exhausted" in text
        or "exceeded your current quota" in text
        or "quota exceeded" in text
        or "quota was exceeded" in text
    )


def _is_tpm_limit(resp) -> bool:
    """True when a 413/429 body is a TOKENS-PER-MINUTE ceiling rather than a
    request that is structurally too large.

    Groq's free-tier TPM budgets are tiny and shared org-wide (measured live:
    llama-3.3-70b-versatile caps at 12K TPM), and its rejection body reads
    "Request too large for model `X` ... on tokens per minute (TPM): Limit N".
    That is a TRANSIENT condition — the per-minute bucket refills on a timer —
    so it deserves a backoff retry, exactly like a plain 429 rate limit. A bare
    "Request Entity Too Large" (no TPM mention) is permanent for that request
    size and is only worth a fail-over, not a retry.
    """
    text = (resp.text or "").lower()
    return "tokens per minute" in text or "request too large for model" in text


async def _call_ai_complete(messages: list[dict]) -> str:
    """One non-streaming chat completion; returns the assistant content string.

    Walks the whole provider chain (_all_configs), highest priority first.
    Within a provider, retries HTTP 429 rate limits honouring Retry-After; a
    hard quota exhaustion (spent daily free-tier cap) or a provider outage
    fails over to the next configured provider instead. Raises RuntimeError
    only once every configured provider has failed, so callers surface a
    friendly SSE error event.
    """
    configs = _all_configs()
    if not configs:
        raise RuntimeError(_missing_key_message())

    last_error = "no provider attempted"
    async with httpx.AsyncClient(timeout=120.0) as client:
        for cfg in configs:
            url = f"{cfg['base_url']}/chat/completions"
            body = _request_body(cfg, messages, stream=False)
            for attempt in range(1, MAX_AI_RETRIES + 1):
                resp = await client.post(url, headers=_headers(cfg), json=body)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                err_text = f"AI API error {resp.status_code}: {resp.text[:200]}"
                last_error = err_text
                if resp.status_code == 429 and _is_quota_exhausted(resp):
                    # A spent daily cap will not clear inside the retry
                    # window — skip the sleeps and move providers now.
                    logger.warning(
                        "AI quota exhausted on %s; failing over: %s",
                        cfg["base_url"],
                        err_text,
                    )
                    break
                # Retryable: a per-minute rate limit (429) OR a transient TPM
                # saturation (413 whose body says "tokens per minute" — the
                # shared free-tier bucket refills on a timer). Wait out the
                # provider's reset and try again; this is what recovers the
                # exact "Request too large ... on tokens per minute" 413 that
                # surfaced when a burst of turns saturated Groq's pool.
                retryable = (
                    resp.status_code == 429
                    or (resp.status_code == 413 and _is_tpm_limit(resp))
                )
                if retryable and attempt < MAX_AI_RETRIES:
                    wait = _retry_after(resp)
                    logger.info("AI rate limit (%s); retrying in %.1fs", resp.status_code, wait)
                    await asyncio.sleep(wait)
                    continue
                if _should_fail_over(resp.status_code) and cfg is not configs[-1]:
                    logger.warning(
                        "AI provider %s unavailable; failing over: %s",
                        cfg["base_url"],
                        err_text,
                    )
                    break
                # Client error (our request is wrong everywhere) or this was
                # the last provider — surface the real error.
                raise RuntimeError(err_text)
    raise RuntimeError(last_error)


async def _call_ai_stream(messages: list[dict]):
    """Stream a chat completion from the configured providers.

    Yields (content_delta, finish_reason) tuples as tokens arrive. Walks the
    whole provider chain (_all_configs), highest priority first; within a
    provider, retries 429 rate limits honouring Retry-After, and a hard quota
    exhaustion or provider outage fails over to the next configured provider.
    Raises RuntimeError only once every provider has failed. Note the failover
    only ever happens BEFORE streaming starts (the 429 arrives on the initial
    POST) — once a 200 stream is flowing, we are committed to it.
    """
    configs = _all_configs()
    if not configs:
        raise RuntimeError(_missing_key_message())

    last_error = "no provider attempted"
    async with httpx.AsyncClient(timeout=120.0) as client:
        for cfg in configs:
            url = f"{cfg['base_url']}/chat/completions"
            body = _request_body(cfg, messages, stream=True)
            attempt = 0
            while True:
                attempt += 1
                async with client.stream(
                    "POST", url, headers=_headers(cfg), json=body
                ) as resp:
                    if resp.status_code == 200:
                        async for line in resp.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            payload = line[len("data:"):].strip()
                            if not payload:
                                continue
                            if payload == "[DONE]":
                                return
                            try:
                                event = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            for choice in event.get("choices") or []:
                                delta = (choice.get("delta") or {}).get("content") or ""
                                if delta:
                                    yield delta, choice.get("finish_reason")
                        return
                    err_body = (await resp.aread()).decode("utf-8", "replace")
                err_text = f"AI API error {resp.status_code}: {err_body[:200]}"
                last_error = err_text
                if resp.status_code == 429 and _is_quota_exhausted(resp):
                    # A spent daily cap will not clear inside the retry window —
                    # skip the sleeps and move providers now.
                    logger.warning(
                        "AI quota exhausted on %s; failing over: %s",
                        cfg["base_url"],
                        err_text,
                    )
                    break
                # Retryable: a per-minute rate limit (429) OR a transient TPM
                # saturation (413 whose body says "tokens per minute"; the
                # shared free-tier bucket refills on a timer). Wait out the
                # provider's reset and try again — this recovers the exact
                # "Request too large ... on tokens per minute" 413 a burst of
                # turns hit on Groq's pool.
                retryable = (
                    resp.status_code == 429
                    or (resp.status_code == 413 and _is_tpm_limit(resp))
                )
                if retryable and attempt < MAX_AI_RETRIES:
                    wait = _retry_after(resp)
                    logger.info("AI rate limit (%s); retrying in %.1fs", resp.status_code, wait)
                    await asyncio.sleep(wait)
                    continue
                if _should_fail_over(resp.status_code) and cfg is not configs[-1]:
                    logger.warning(
                        "AI provider %s unavailable; failing over: %s",
                        cfg["base_url"],
                        err_text,
                    )
                    break
                raise RuntimeError(err_text)
    raise RuntimeError(last_error)


# ── LLM message construction ──────────────────────────────────────────────────

# Cap on how many of the user's forms are listed verbatim in the author
# context block; beyond this they're summarized so the prompt stays small.
AUTHOR_CONTEXT_FORM_CAP = 50

# Caps on how much of the conversation history is embedded VERBATIM in the
# prompt. History exists so follow-ups stay grounded in what was said, but the
# raw text (a form source can be many KB and every assistant turn re-attaches
# it) inflates the request until free-tier TPM ceilings reject it outright —
# Groq's llama-3.3-70b-versatile limits at 12K tokens/minute, and a single
# turn plus its fixup retry can blow that in one request. Long text is clipped
# to a bounded prefix with an explicit note so the model knows it's partial.
HISTORY_MESSAGE_CLIP = 2000
HISTORY_FORM_CODE_CLIP = 2000


def _clip(text: str, limit: int) -> str:
    """Truncate `text` to `limit` chars, marking the cut so the model knows the
    text is partial rather than assuming it's the whole thing."""
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n[... {len(text) - limit} chars omitted]"


def _user_context(db: Session, user: User) -> str:
    """Build the author's account context block for one chat turn.

    Queries the CURRENT user's real profile + form catalog (with per-form
    response counts) so the model can answer account questions — "how many
    forms have I created?", "find my registration form", "what are the stats
    of form X" — with actual data instead of guessing. This is the "whole
    context" the conversational mode needs.
    """
    now = datetime.now(timezone.utc)
    lines = ["<author_context>"]
    profile = (
        f"name={user.name or '(not set)'} | email={user.email} | "
        f"member_since={user.created_at.date().isoformat() if user.created_at else 'unknown'}"
    )
    lines.append("profile: " + profile)

    rows = (
        db.query(Form, Project.title, func.count(Submission.id).label("resp_count"))
        .join(Project, Form.project_id == Project.id)
        .outerjoin(Submission, Submission.form_id == Form.id)
        .filter(Project.owner_id == user.id)
        .group_by(Form.id, Project.title)
        .order_by(Form.created_at.asc())
        .all()
    )
    lines.append(
        f"stats: total_forms={len(rows)} | "
        f"published_forms={sum(1 for f, _p, _c in rows if f.is_published)} | "
        f"total_submissions={sum(c for _f, _p, c in rows)}"
    )
    lines.append("forms:")
    for form, project_title, resp_count in rows[:AUTHOR_CONTEXT_FORM_CAP]:
        lines.append(
            f"- title={form.title!r} | id={form.id} | project={project_title!r} | "
            f"published={'yes' if form.is_published else 'no'} | "
            f"created={form.created_at.date().isoformat() if form.created_at else 'unknown'} | "
            f"responses={resp_count}"
        )
    if len(rows) > AUTHOR_CONTEXT_FORM_CAP:
        lines.append(f"...and {len(rows) - AUTHOR_CONTEXT_FORM_CAP} more forms")
    lines.append("</author_context>")
    return "\n".join(lines)


def _build_context(req: AiChatRequest) -> str:
    """Assemble the structural context block: current source, selected code
    (if any), and the latest compiler diagnostics."""
    parts = []
    parts.append("<current_source>\n" + (req.source or "") + "\n</current_source>")
    if req.selection:
        parts.append("<selected_code>\n" + req.selection + "\n</selected_code>")
    diag_block = "<compiler_diagnostics>\n"
    if req.diagnostics:
        for d in req.diagnostics:
            diag_block += f"- {d.severity} (line {d.line}, col {d.col}): {d.message}\n"
    else:
        diag_block += "none - the form currently compiles cleanly.\n"
    diag_block += "</compiler_diagnostics>"
    parts.append(diag_block)
    return "\n\n".join(parts)


def _repair_turn(req: AiChatRequest) -> str:
    """The user-turn text for a compile-and-repair follow-up.

    The client compiled the model's previous revisedSource with its WASM
    compiler, it failed, and this turn carries the exact diagnostics so the
    model can fix them rather than guess.
    """
    rc = req.repair_context
    lines = [
        "The FormL source in <current_source> is the complete source you produced "
        "in your previous reply. It does NOT compile.",
        f"This is repair attempt {rc.attempt} of at most 2.",
    ]
    if rc.errors:
        lines.append("The compiler reported these errors:")
        for e in rc.errors:
            lines.append(f"  - {e.severity} at line {e.line}, col {e.col}: {e.message}")
    else:
        lines.append("The compiler rejected it but reported no specific diagnostics.")
    lines.append(
        "Fix every error. Re-read the EBNF grammar in the system prompt - do not "
        "invent syntax. Return the complete corrected FormL source in the JSON. "
        "Preserve every part of the source that already compiles, unchanged."
    )
    return "\n".join(lines)


def _build_messages(req: AiChatRequest, system_prompt: str, user_context: str = "") -> list[dict]:
    """Construct the full OpenAI-style message list for one LLM call.

    Order matters:
      1. system prompt (with embedded grammar)
      2. system context (source / selection / diagnostics)
      3. author context (profile + form catalog — lets the model answer
         account questions about the user's own forms)
      4. optional system summary of older history
      5. recent messages VERBATIM (assistant turns carry their forml code so
         follow-ups are grounded in the exact source the assistant stood on)
      6. the current user turn (or the repair turn, when this call is one)
    """
    messages = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "system", "content": _build_context(req)})

    if user_context and user_context.strip():
        messages.append({"role": "system", "content": user_context.strip()})

    if req.history_summary and req.history_summary.strip():
        messages.append(
            {"role": "system", "content": "Earlier conversation summary:\n" + req.history_summary.strip()}
        )

    for m in req.recent_messages:
        content = _clip(m.content or "", HISTORY_MESSAGE_CLIP)
        if m.role == "assistant" and m.forml_code:
            content += (
                "\n\nThe complete FormL source I produced then was:\n\n```forml\n"
                + _clip(m.forml_code, HISTORY_FORM_CODE_CLIP)
                + "\n```"
            )
        messages.append({"role": m.role, "content": content})

    if req.repair_context is not None:
        messages.append({"role": "user", "content": _repair_turn(req)})
    else:
        messages.append({"role": "user", "content": req.user_message or ""})

    return messages


# ── Chat turn (SSE) ───────────────────────────────────────────────────────────

def _sse(event: dict) -> str:
    return "data: " + json.dumps(event) + "\n\n"


async def _chat_stream(req: AiChatRequest, user_context: str = ""):
    """Async generator yielding SSE events for one chat turn.

    Event types emitted:
      {"type": "delta",  "text": ...}        — streaming explanation increment
      {"type": "result", "explanation": ..., "revised_source": ...} — final
                                               (revised_source is null on a
                                               conversational turn)
      {"type": "error",  "message": ...}     — unrecoverable failure
    """
    if _active_config() is None:
        yield _sse({
            "type": "error",
            "message": "Formix AI is not configured - " + _missing_key_message(),
        })
        return

    system_prompt = _system_prompt()
    messages = _build_messages(req, system_prompt, user_context)

    # Only the explanation is streamed incrementally; revisedSource is always
    # taken from the fully-parsed reply (see _parse_strict).
    scanner = StreamingJsonScanner(keys=["explanation"])
    raw = ""
    streamed_explanation = ""
    truncated = False
    try:
        async for chunk, reason in _call_ai_stream(messages):
            raw += chunk
            # finish_reason "length" means the provider stopped us mid-reply at
            # the token budget — the JSON is guaranteed incomplete. Remember it
            # so we can (a) tell the model the real cause on retry and (b) give
            # the user an actionable message instead of a generic shape error.
            if reason == "length":
                truncated = True
            deltas = scanner.feed(chunk)
            for text in deltas.values():
                if text:
                    streamed_explanation += text
                    yield _sse({"type": "delta", "text": text})
    except RuntimeError as exc:
        logger.error("AI streaming failed: %s", exc)
        yield _sse({"type": "error", "message": f"Could not reach the AI model: {exc}"})
        return

    # Validate the complete reply against the accepted shapes.
    parsed = _parse_strict(raw)
    if parsed is None:
        # One corrective retry. A truncated reply is a DIFFERENT failure from a
        # shape violation — the model needs to know it ran out of tokens (and
        # that the explanation should be short) rather than be told its JSON
        # was malformed.
        fixup = TRUNCATION_INSTRUCTION if truncated else FIXUP_INSTRUCTION
        try:
            retry_content = await _call_ai_complete(messages + [
                {"role": "user", "content": fixup},
            ])
            parsed = _parse_strict(retry_content)
        except RuntimeError as exc:
            logger.error("AI retry failed: %s", exc)
            yield _sse({"type": "error", "message": f"Could not reach the AI model: {exc}"})
            return
    if parsed is None:
        logger.warning(
            "AI reply failed (%s); raw=%r",
            "truncated at token limit" if truncated else "shape validation",
            _summarize_raw(raw),
        )
        if truncated:
            message = (
                "The AI reply was cut off before it finished — the form was too "
                "large for a single response. Try again, or ask for a smaller change."
            )
        else:
            message = "The AI returned a reply that isn't the required JSON shape. Try again."
        yield _sse({"type": "error", "message": message})
        return

    explanation = parsed.get("explanation", "")
    # Missing revisedSource means this was a conversational turn (no edit).
    revised_source = parsed.get("revisedSource")

    # A repair turn MUST produce a full revised source — a conversational reply
    # there means the model dodged the fix instead of addressing the compiler
    # errors, which is a shape failure (never silently accept a still-broken
    # source as "no change").
    if req.repair_context is not None and not isinstance(revised_source, str):
        logger.warning("AI repair reply missing revisedSource; raw=%r", _summarize_raw(raw))
        yield _sse({
            "type": "error",
            "message": "The AI returned a reply that isn't the required JSON shape. Try again.",
        })
        return

    # If the scanner never streamed anything (e.g. the JSON had to be recovered
    # by the fallback parse), deliver the explanation now as one delta.
    if not streamed_explanation and explanation:
        streamed_explanation += explanation
        yield _sse({"type": "delta", "text": explanation})

    yield _sse({
        "type": "result",
        "explanation": explanation,
        "revised_source": revised_source,
    })


@router.post("/forms/{form_id}/chat", response_model=None)
async def chat_turn(
    form_id: str,
    body: AiChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run one AI chat turn for a form the current user owns. Streams SSE.

    Ownership is checked up front (before any streaming) so a 403 is a clean
    HTTP error rather than an in-stream event.
    """
    get_form_or_403(form_id, current_user, db)
    return StreamingResponse(
        _chat_stream(body, _user_context(db, current_user)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Conversation persistence ──────────────────────────────────────────────────

@router.get("/forms/{form_id}/history", response_model=AiChatHistoryResponse)
def get_history(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the full persisted conversation for a form, oldest first."""
    get_form_or_403(form_id, current_user, db)
    messages = (
        db.query(AiChatMessage)
        .filter(AiChatMessage.form_id == form_id)
        .order_by(AiChatMessage.created_at.asc())
        .all()
    )
    return {"messages": messages}


@router.post("/forms/{form_id}/messages", response_model=AiAppendResponse)
def append_message(
    form_id: str,
    body: AiAppendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist one completed turn (user message + assistant reply) once the
    client's compile-and-repair loop has resolved. Trims the stored history to
    the newest HISTORY_CAP messages."""
    get_form_or_403(form_id, current_user, db)
    db.add(AiChatMessage(form_id=form_id, role="user", content=body.user_message))
    db.add(
        AiChatMessage(
            form_id=form_id,
            role="assistant",
            content=body.assistant_message,
            revised_source=body.revised_source,
        )
    )
    db.commit()

    # Trim to the newest HISTORY_CAP, oldest first query -> delete the surplus
    # from the front.
    kept = (
        db.query(AiChatMessage.id)
        .filter(AiChatMessage.form_id == form_id)
        .order_by(AiChatMessage.created_at.desc())
        .offset(HISTORY_CAP)
        .all()
    )
    for (old_id,) in kept:
        db.query(AiChatMessage).filter(AiChatMessage.id == old_id).delete()
    db.commit()

    count = (
        db.query(AiChatMessage)
        .filter(AiChatMessage.form_id == form_id)
        .count()
    )
    return {"ok": True, "count": count}


@router.delete("/forms/{form_id}/messages", response_model=AiAppendResponse)
def clear_history(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear a form's AI conversation history."""
    get_form_or_403(form_id, current_user, db)
    db.query(AiChatMessage).filter(AiChatMessage.form_id == form_id).delete()
    db.commit()
    return {"ok": True, "count": 0}
