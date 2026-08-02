"""
backend/routers/ai.py
LLM-backed Formix AI chat endpoint.

Replaces the rule-based generator in the frontend (lib/ai-engine.ts) with a real
LLM call. This router:

  - embeds the canonical Forml EBNF grammar (forml-compiler/EBNF_grammar.md)
    into the system prompt on EVERY request, so the model never invents syntax
  - is a two-mode assistant: CONVERSATION (`{"explanation": ...}` — questions,
    doubts, teaching) and EDITING (`{"explanation", "revisedSource"}`), with the
    model choosing the shape per turn (see _parse_strict)
  - streams the explanation to the client token-by-token (SSE) while the
    full reply is still being generated
  - validates the complete reply, and on any deviation (markdown fences,
    extra commentary, malformed JSON) makes ONE corrective retry before giving
    up with an error event; repair turns (repair_context) still require a full
    revised source so a broken form is never silently accepted
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
#   GROQ_API_KEY (+ GROQ_* variables, legacy)
#                 -> Groq, used only when AI_API_KEY is not set
#
# _active_config() reads these lazily at request time, so swapping providers is
# an env change (restart the server), not a code change.
DEFAULT_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
DEFAULT_AI_MODEL = "gemini-3.6-flash"
DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

# 429 rate-limit handling. Both free tiers throttle per minute, and a burst of
# chat turns will hit it; retry up to this many times, honouring the provider's
# Retry-After / reset headers (see _retry_after).
MAX_AI_RETRIES = 3

# Path to the canonical grammar. resolved relative to this file so it works no
# matter where uvicorn is launched from: backend/routers/ai.py -> repo root ->
# forml-compiler/EBNF_grammar.md
_GRAMMAR_PATH = Path(__file__).resolve().parents[2] / "forml-compiler" / "EBNF_grammar.md"


def _active_config() -> dict | None:
    """Resolve the active provider config from the environment.

    Priority:
      1. AI_API_KEY set     -> AI_* variables (Gemini defaults)
      2. GEMINI_API_KEY set -> Gemini defaults (shortcut for Google AI Studio)
      3. GROQ_API_KEY set   -> GROQ_* variables (legacy Groq)
      4. none set           -> None (the endpoint reports a friendly error)

    Returns {"base_url", "model", "api_key", "temperature", "max_tokens"}.
    """
    ai_key = os.environ.get("AI_API_KEY", "").strip()
    if ai_key:
        return {
            "base_url": os.environ.get("AI_BASE_URL", "").strip() or DEFAULT_AI_BASE_URL,
            "model": os.environ.get("AI_MODEL", "").strip() or DEFAULT_AI_MODEL,
            "api_key": ai_key,
            "temperature": float(os.environ.get("AI_TEMPERATURE", "0.3")),
            "max_tokens": int(os.environ.get("AI_MAX_TOKENS", "4096")),
        }
    # Google AI Studio's preferred env var name; maps to the same Gemini
    # defaults as AI_API_KEY so either spelling works.
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if gemini_key:
        return {
            "base_url": os.environ.get("AI_BASE_URL", "").strip() or DEFAULT_AI_BASE_URL,
            "model": os.environ.get("AI_MODEL", "").strip() or DEFAULT_AI_MODEL,
            "api_key": gemini_key,
            "temperature": float(os.environ.get("AI_TEMPERATURE", "0.3")),
            "max_tokens": int(os.environ.get("AI_MAX_TOKENS", "4096")),
        }
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        return {
            "base_url": os.environ.get("GROQ_BASE_URL", "").strip() or DEFAULT_GROQ_BASE_URL,
            "model": os.environ.get("GROQ_MODEL", "").strip() or DEFAULT_GROQ_MODEL,
            "api_key": groq_key,
            "temperature": float(os.environ.get("GROQ_TEMPERATURE", "0.3")),
            "max_tokens": int(os.environ.get("GROQ_MAX_TOKENS", "4096")),
        }
    return None


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
1. If an edit request is ambiguous, ask exactly ONE concise clarifying question instead of guessing.
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


def _parse_strict(raw: str):
    """Parse the model's reply into the accepted response shapes.

    Returns a dict with "explanation" (str) and, for edit turns, "revisedSource"
    (str), or None. Two shapes are valid:
      - {"explanation": "..."}                  — conversational turn
      - {"explanation": "...", "revisedSource": "..."} — edit turn
    Tolerates only (a) pure JSON, (b) JSON wrapped in a single markdown fence,
    and (c) JSON embedded in surrounding prose — anything else is a shape
    violation and triggers the corrective retry.
    """
    candidates = []
    text = (raw or "").strip()
    if text:
        candidates.append(text)

    # A single markdown fenced block around the JSON (```` ```json ... ``` ````).
    if text.startswith("```"):
        body = text
        for line in text.splitlines():
            if line.strip().startswith("```"):
                body = body[body.find(line) + len(line):].lstrip("\n")
                break
        if body.rstrip().endswith("```"):
            body = body.rstrip()[:-3].rstrip()
        if body.strip():
            candidates.append(body.strip())

    # Largest {...} span in the text, as a last resort for stray prose around
    # the JSON.
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        span = text[start:end + 1]
        if span not in candidates:
            candidates.append(span)

    for candidate in candidates:
        try:
            obj = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        if not isinstance(obj, dict):
            continue
        # "explanation" is mandatory in both shapes.
        if not isinstance(obj.get("explanation"), str):
            continue
        # "revisedSource" is optional (conversational) but, when present, must
        # be a string (an edit). Numbers/objects/etc. are shape violations.
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


async def _call_ai_complete(messages: list[dict]) -> str:
    """One non-streaming chat completion; returns the assistant content string.

    Retries on HTTP 429 (rate limit) honouring Retry-After, then raises
    RuntimeError on any remaining transport/HTTP error so callers can surface a
    friendly SSE error event.
    """
    cfg = _active_config()
    if cfg is None:
        raise RuntimeError(_missing_key_message())
    url = f"{cfg['base_url']}/chat/completions"
    body = _request_body(cfg, messages, stream=False)
    async with httpx.AsyncClient(timeout=120.0) as client:
        for attempt in range(1, MAX_AI_RETRIES + 1):
            resp = await client.post(url, headers=_headers(cfg), json=body)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            err_text = resp.text[:200]
            if resp.status_code == 429 and attempt < MAX_AI_RETRIES:
                wait = _retry_after(resp)
                logger.info("AI rate limit (429); retrying in %.1fs", wait)
                await asyncio.sleep(wait)
                continue
            raise RuntimeError(f"AI API error {resp.status_code}: {err_text}")


async def _call_ai_stream(messages: list[dict]):
    """Stream a chat completion from the configured provider.

    Yields (content_delta, finish_reason) tuples as tokens arrive. Retries on
    429 rate limits (honouring Retry-After), then raises RuntimeError on any
    remaining transport/HTTP error.
    """
    cfg = _active_config()
    if cfg is None:
        raise RuntimeError(_missing_key_message())
    url = f"{cfg['base_url']}/chat/completions"
    body = _request_body(cfg, messages, stream=True)
    async with httpx.AsyncClient(timeout=120.0) as client:
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
            if resp.status_code == 429 and attempt < MAX_AI_RETRIES:
                wait = _retry_after(resp)
                logger.info("AI rate limit (429); retrying in %.1fs", wait)
                await asyncio.sleep(wait)
                continue
            raise RuntimeError(f"AI API error {resp.status_code}: {err_body[:200]}")


# ── LLM message construction ──────────────────────────────────────────────────

# Cap on how many of the user's forms are listed verbatim in the author
# context block; beyond this they're summarized so the prompt stays small.
AUTHOR_CONTEXT_FORM_CAP = 50


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
        content = m.content or ""
        if m.role == "assistant" and m.forml_code:
            content += "\n\nThe complete FormL source I produced then was:\n\n```forml\n" + m.forml_code + "\n```"
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
    try:
        async for chunk, _reason in _call_ai_stream(messages):
            raw += chunk
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
        # One corrective retry, asking for exactly the right shape.
        try:
            retry_content = await _call_ai_complete(messages + [
                {"role": "user", "content": FIXUP_INSTRUCTION},
            ])
            parsed = _parse_strict(retry_content)
        except RuntimeError as exc:
            logger.error("AI retry failed: %s", exc)
            yield _sse({"type": "error", "message": f"Could not reach the AI model: {exc}"})
            return
    if parsed is None:
        logger.warning("AI reply failed shape validation; raw=%r", raw[:300])
        yield _sse({
            "type": "error",
            "message": "The AI returned a reply that isn't the required JSON shape. Try again.",
        })
        return

    explanation = parsed.get("explanation", "")
    # Missing revisedSource means this was a conversational turn (no edit).
    revised_source = parsed.get("revisedSource")

    # A repair turn MUST produce a full revised source — a conversational reply
    # there means the model dodged the fix instead of addressing the compiler
    # errors, which is a shape failure (never silently accept a still-broken
    # source as "no change").
    if req.repair_context is not None and not isinstance(revised_source, str):
        logger.warning("AI repair reply missing revisedSource; raw=%r", raw[:300])
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
