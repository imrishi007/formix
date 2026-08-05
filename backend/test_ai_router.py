"""
backend/test_ai_router.py
Self-contained pytest suite for the LLM-backed Formix AI chat router
(backend/routers/ai.py).

No server, no network, no real LLM:
  - the DB is an in-memory SQLite (StaticPool so every request shares it),
    with `get_db` overridden
  - auth is bypassed by overriding `get_current_user`
  - the Groq transport (`_call_ai_stream` / `_call_ai_complete`) is
    monkeypatched with deterministic fakes, so the streaming-JSON extraction,
    strict-shape retry, and error paths are all exercised for real

Run from the repo root:
    python -m pytest backend/test_ai_router.py -q
"""

import json
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Make the repo root importable no matter the CWD.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# The router reads the API key from the environment per-call, so setting it
# here (before anything else) makes the happy paths runnable; the
# missing-key test clears it via monkeypatch.
os.environ["GROQ_API_KEY"] = "test-key"

from backend import models  # noqa: E402  (registers all models on Base.metadata)
from backend.auth import get_current_user  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.main import app  # noqa: E402
from backend.routers import ai as ai_module  # noqa: E402


# ── Test DB + auth overrides ──────────────────────────────────────────────────

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
Base.metadata.create_all(_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _reset_overrides():
    """Clear dependency overrides and the DB between tests, and default the
    current user to user A."""
    app.dependency_overrides.clear()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    db = _TestingSessionLocal()
    user_a = models.User(id="user_a", email="a@test.com", hashed_password="x")
    user_b = models.User(id="user_b", email="b@test.com", hashed_password="x")
    project = models.Project(id="proj_1", owner_id="user_a", title="A's project")
    form = models.Form(
        id="form_1",
        project_id="proj_1",
        title="Contact",
        forml_source="form Contact {}",
    )
    db.add_all([user_a, user_b, project, form])
    db.commit()
    db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: models.User(id="user_a", email="a@test.com", hashed_password="x")
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    return TestClient(app)  # no `with` — lifespan/alembic must NOT run


# ── Fake Groq transport ───────────────────────────────────────────────────────

def _stream_of(reply: str, chunk_size: int = 7):
    """Fake _call_ai_stream: yields the reply in small chunks, exactly like a
    real token stream (this is what exercises the streaming JSON scanner)."""
    async def _stream(messages):
        for i in range(0, len(reply), chunk_size):
            yield reply[i:i + chunk_size], None
    return _stream


async def _complete_with(reply: str, messages):
    """Fake _call_ai_complete used for the corrective shape retry."""
    return reply


def _chat_payload(source: str = "form Contact {}") -> dict:
    return {
        "form_id": "form_1",
        "user_message": "Add an email field",
        "source": source,
        "diagnostics": [],
        "selection": "",
        "recent_messages": [],
        "history_summary": "",
    }


def _parse_sse(text: str) -> list[dict]:
    events = []
    for raw in text.strip().split("\n\n"):
        for line in raw.split("\n"):
            if line.startswith("data:"):
                events.append(json.loads(line[len("data:"):].strip()))
    return events


def _raises(text: str) -> bool:
    """True when the string is genuinely invalid JSON (the test's sanity check
    that a repair case was actually broken to begin with)."""
    try:
        json.loads(text)
        return False
    except (json.JSONDecodeError, ValueError):
        return True


VALID_REPLY = (
    '{"explanation": "Added a required email field with validation.\\n\\n'
    'It is now the first field.", '
    '"revisedSource": "form Contact {\\n  field email : email {\\n'
    '    validate { required }\\n  }\\n}"}'
)

# A pure conversational reply — no revisedSource, no echo of the source. This is
# what the model returns for questions / doubts / explanations (no edit).
CONVERSATIONAL_REPLY = (
    '{"explanation": "Forml is a forms-as-code DSL. You define a form with the '
    '`form` keyword, then list fields with `field name : type`. For example: '
    '\\n\\n```forml\\nform Contact {\\n  field email : email\\n}\\n```"}'
)


# ── System prompt / grammar ───────────────────────────────────────────────────

def test_system_prompt_embeds_the_ebnf_grammar():
    prompt = ai_module._system_prompt()
    assert "You are Formix AI" in prompt
    assert "EBNF_GRAMMAR" in prompt
    assert "revisedSource" in prompt
    # The grammar itself is substantial (the source of truth, not a stub).
    assert len(ai_module._load_grammar()) > 1000


# ── Provider config (env-driven) ──────────────────────────────────────────────

def test_active_config_prefers_ai_key_over_gemini_and_groq(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "ai-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    cfg = ai_module._active_config()
    assert cfg["api_key"] == "ai-key"
    assert "generativelanguage" in cfg["base_url"]   # Gemini default
    assert cfg["model"] == ai_module.DEFAULT_AI_MODEL

    # GEMINI_API_KEY alone maps to the same Gemini defaults.
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    cfg = ai_module._active_config()
    assert cfg["api_key"] == "gem-key"
    assert "generativelanguage" in cfg["base_url"]

    # With no Gemini keys, the legacy Groq path still works unchanged.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    cfg = ai_module._active_config()
    assert cfg["api_key"] == "groq-key"
    assert "groq.com" in cfg["base_url"]

    # With no key at all, config is None -> friendly error downstream.
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert ai_module._active_config() is None


def test_request_body_is_openai_compatible_and_gemini_tailored(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "ai-key")
    cfg = ai_module._active_config()
    body = ai_module._request_body(cfg, [{"role": "user", "content": "hi"}], stream=True)
    assert     body["stream"] is True
    assert body["response_format"] == {"type": "json_object"}
    # Thinking minimized for Gemini flash models (fast, cheap replies).
    assert body["reasoning_effort"] == "minimal"

    # Non-Gemini providers get a plain OpenAI body (no Gemini-only fields).
    groq_cfg = {"base_url": "https://api.groq.com/openai/v1", "model": "x",
                "api_key": "k", "temperature": 0.3, "max_tokens": 4096}
    body = ai_module._request_body(groq_cfg, [], stream=False)
    assert "reasoning_effort" not in body


def test_retry_after_parsing():
    class FakeResp:
        def __init__(self, headers):
            self.headers = headers

    assert ai_module._retry_after(FakeResp({"Retry-After": "3"})) == 3.0
    assert ai_module._retry_after(FakeResp({"x-ratelimit-reset-tokens": "2m5.5s"})) == 125.5
    assert ai_module._retry_after(FakeResp({"x-ratelimit-reset-tokens-minute": "7.66s"})) == 7.66
    assert ai_module._retry_after(FakeResp({})) == 5.0  # conservative default


# ── Streaming chat turn ───────────────────────────────────────────────────────

def test_parse_strict_accepts_both_response_shapes():
    """The contract is two shapes: explanation-only (conversation) and
    explanation+revisedSource (edit). Everything else is a shape violation."""
    assert ai_module._parse_strict('{"explanation": "hi"}') == {"explanation": "hi"}
    edit = ai_module._parse_strict('{"explanation": "hi", "revisedSource": "form X {}"}')
    assert edit["explanation"] == "hi"
    assert edit["revisedSource"] == "form X {}"

    # Missing explanation → no shape. explanation not a string → no shape.
    # revisedSource present but not a string → no shape.
    assert ai_module._parse_strict('{"revisedSource": "form X {}"}') is None
    assert ai_module._parse_strict('{"explanation": 42}') is None
    assert ai_module._parse_strict('{"explanation": "hi", "revisedSource": 42}') is None
    assert ai_module._parse_strict("definitely not json") is None


def test_parse_strict_recovers_raw_multiline_revised_source():
    """The model's single most common failure: embedding the Forml source in
    revisedSource with LITERAL newlines instead of \\n escapes — invalid JSON
    that the lenient repair must recover (this is the GATE-score case)."""
    raw = (
        '{\n'
        '  "explanation": "Here is your form. It collects the GATE score and '
        'the candidate roll number.",\n'
        '  "revisedSource": "form GATE Registration {\n'
        '    field rollNumber : text {\n'
        '      validate { required }\n'
        '    }\n'
        '    field score : integer {\n'
        '      validate { min: 0 max: 100 required }\n'
        '    }\n'
        '  }"\n'
        '}'
    )
    assert _raises(raw)  # sanity: it really is broken
    parsed = ai_module._parse_strict(raw)
    assert parsed is not None
    assert parsed["explanation"].startswith("Here is your form.")
    assert "field rollNumber : text" in parsed["revisedSource"]
    assert "validate { min: 0 max: 100 required }" in parsed["revisedSource"]


def test_parse_strict_repairs_unescaped_quotes():
    """A label with quotes inside revisedSource, left unescaped by the model,
    must be recovered — Forml sources are full of \" (labels, options,
    patterns), so this is not a corner case."""
    raw = (
        '{"explanation": "Added the field the way you asked.", '
        '"revisedSource": "form GATE { field score : integer { label "GATE Score" } }"}'
    )
    assert _raises(raw)  # sanity: the unescaped quotes really are broken JSON
    parsed = ai_module._parse_strict(raw)
    assert parsed is not None
    assert 'label "GATE Score"' in parsed["revisedSource"]
    assert parsed["explanation"] == "Added the field the way you asked."


def test_parse_strict_repairs_newlines_quotes_and_trailing_commas():
    """The nastiest realistic reply: literal newlines AND unescaped quotes AND
    a trailing comma all at once. The repair must recover it as a whole."""
    raw = (
        '{\n'
        '  "explanation": "The label is "GATE Score", as requested.",\n'
        '  "revisedSource": "form GATE {\n'
        '    field score : integer\n'
        '  }",\n'
        '}'
    )
    assert _raises(raw)
    parsed = ai_module._parse_strict(raw)
    assert parsed is not None
    assert parsed["explanation"] == 'The label is "GATE Score", as requested.'
    assert "field score : integer" in parsed["revisedSource"]


def test_parse_strict_tolerates_prose_and_fences_around_json():
    """Models wrap the JSON in ```json fences and/or add commentary around it.
    The parser must find the object either way."""
    for raw in (
        "Sure! Here you go:\n\n```json\n" + VALID_REPLY + "\n```\n\nHope that helps.",
        "Sure! Here you go:\n\n" + VALID_REPLY + "\n\nThat should do it.",
    ):
        parsed = ai_module._parse_strict(raw)
        assert parsed is not None
        assert "field email : email" in parsed["revisedSource"]


def test_default_max_tokens_is_8192(monkeypatch):
    """Edit turns embed the whole form source in one JSON string; the old 4096
    default truncated long forms mid-JSON. 8192 must be the new default."""
    for key in ("AI_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    assert ai_module._active_config()["max_tokens"] == 8192


def test_chat_streams_explanation_and_returns_result(client, monkeypatch):
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of(VALID_REPLY))
    monkeypatch.setattr(ai_module, "_call_ai_complete", lambda m: "{}")

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())

    assert resp.status_code == 200
    events = _parse_sse(resp.text)

    deltas = [e for e in events if e["type"] == "delta"]
    results = [e for e in events if e["type"] == "result"]

    # Explanation streamed in pieces before the result arrived.
    assert len(deltas) > 1
    streamed = "".join(e["text"] for e in deltas)
    assert "Added a required email field" in streamed
    assert "It is now the first field." in streamed

    assert len(results) == 1
    assert "email field" in results[0]["explanation"]
    assert "field email : email" in results[0]["revised_source"]
    # The event order: deltas first, result last.
    assert events[-1]["type"] == "result"


def test_chat_recovers_malformed_reply_via_corrective_retry(client, monkeypatch):
    """Stream returns garbage; the strict-shape check fires ONE corrective
    retry (non-streaming) whose reply is parsed successfully."""
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of("not json at all"))
    calls = {"n": 0}

    async def complete(messages):
        calls["n"] += 1
        assert any("Reply with EXACTLY a single JSON object" in m["content"] for m in messages)
        return VALID_REPLY

    monkeypatch.setattr(ai_module, "_call_ai_complete", complete)

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    result = [e for e in events if e["type"] == "result"]
    assert len(result) == 1
    assert "field email : email" in result[0]["revised_source"]
    assert calls["n"] == 1


def test_chat_fails_when_reply_never_matches_the_shape(client, monkeypatch):
    """Both the stream and the corrective retry fail shape validation → an
    error event, never a result, never a crash."""
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of("nope"))
    async def complete(messages):
        return "still nope"
    monkeypatch.setattr(ai_module, "_call_ai_complete", complete)

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    errors = [e for e in events if e["type"] == "error"]
    assert len(errors) == 1
    assert "JSON shape" in errors[0]["message"]
    assert not [e for e in events if e["type"] == "result"]


def test_chat_truncation_recovered_by_retry(client, monkeypatch):
    """The stream ends with finish_reason 'length' (reply cut off mid-JSON).
    The corrective retry must use the truncation instruction and can still
    produce a usable result."""
    async def stream(messages):
        yield '{"explanation": "cut off right here', None
        yield "", "length"
    calls = {"n": 0}
    async def complete(messages):
        calls["n"] += 1
        assert any("cut off before it finished" in m["content"] for m in messages)
        return VALID_REPLY
    monkeypatch.setattr(ai_module, "_call_ai_stream", stream)
    monkeypatch.setattr(ai_module, "_call_ai_complete", complete)

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    results = [e for e in _parse_sse(resp.text) if e["type"] == "result"]
    assert len(results) == 1
    assert "field email : email" in results[0]["revised_source"]
    assert calls["n"] == 1


def test_chat_truncation_failure_yields_cutoff_message(client, monkeypatch):
    """A reply cut off at the token limit (and a failed retry) must produce an
    actionable truncation message, not the generic JSON-shape one."""
    async def stream(messages):
        yield '{"explanation": "cut off', None
        yield "", "length"
    async def complete(messages):
        return "still not json"
    monkeypatch.setattr(ai_module, "_call_ai_stream", stream)
    monkeypatch.setattr(ai_module, "_call_ai_complete", complete)

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    errors = [e for e in _parse_sse(resp.text) if e["type"] == "error"]
    assert len(errors) == 1
    assert "cut off" in errors[0]["message"]
    assert "JSON shape" not in errors[0]["message"]
    assert not [e for e in _parse_sse(resp.text) if e["type"] == "result"]


def test_chat_conversational_reply_streams_and_returns_null_revised_source(client, monkeypatch):
    """A question / doubt / explanation produces a result with no source:
    revised_source is null, and the explanation (with markdown) still streams."""
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of(CONVERSATIONAL_REPLY))
    monkeypatch.setattr(ai_module, "_call_ai_complete", lambda m: "{}")

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    events = _parse_sse(resp.text)

    results = [e for e in events if e["type"] == "result"]
    assert len(results) == 1
    assert results[0]["revised_source"] is None
    assert "forms-as-code DSL" in results[0]["explanation"]

    # The explanation still streams incrementally before the result.
    deltas = [e for e in events if e["type"] == "delta"]
    assert len(deltas) > 0
    assert "".join(e["text"] for e in deltas) == results[0]["explanation"]
    assert events[-1]["type"] == "result"


def test_repair_turn_requires_revised_source(client, monkeypatch):
    """A repair turn that comes back conversational (no revisedSource) is a
    shape failure — the model dodged the fix, so a broken source must never be
    accepted as a silent "no change"."""
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of(CONVERSATIONAL_REPLY))
    async def complete(messages):
        return CONVERSATIONAL_REPLY
    monkeypatch.setattr(ai_module, "_call_ai_complete", complete)

    payload = _chat_payload()
    payload["repair_context"] = {
        "attempt": 1,
        "errors": [{"line": 1, "col": 1, "severity": "error", "message": "unexpected token"}],
    }
    resp = client.post("/ai/forms/form_1/chat", json=payload)
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    errors = [e for e in events if e["type"] == "error"]
    assert len(errors) == 1
    assert "JSON shape" in errors[0]["message"]
    assert not [e for e in events if e["type"] == "result"]


def test_chat_denies_access_to_other_users_form(client, monkeypatch):
    """Ownership is enforced before any streaming — a foreign user gets a
    clean 403 HTTP error, not an in-stream event."""
    monkeypatch.setattr(ai_module, "_call_ai_stream", _stream_of(VALID_REPLY))
    app.dependency_overrides[get_current_user] = lambda: models.User(id="user_b", email="b@test.com", hashed_password="x")

    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 403


def test_chat_missing_api_key_returns_clean_error(client, monkeypatch):
    # All three accepted key names must be absent for the missing-key path.
    for key in ("AI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    resp = client.post("/ai/forms/form_1/chat", json=_chat_payload())
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    errors = [e for e in events if e["type"] == "error"]
    assert len(errors) == 1
    assert "AI_API_KEY" in errors[0]["message"]


# ── History persistence ───────────────────────────────────────────────────────

def test_append_history_prune_and_clear(client):
    headers = {"Authorization": "Bearer whatever"}

    for i in range(12):  # 12 turns × 2 messages = 24 messages
        resp = client.post(
            "/ai/forms/form_1/messages",
            json={
                "user_message": f"turn {i}",
                "assistant_message": f"reply {i}",
                "revised_source": f"form Contact {{ field_{i} }}",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    # Server history is capped at HISTORY_CAP (20) messages, newest retained.
    history = client.get("/ai/forms/form_1/history", headers=headers).json()["messages"]
    assert len(history) == ai_module.HISTORY_CAP == 20

    # Oldest message was pruned (turn 0 is gone), newest is intact.
    contents = [m["content"] for m in history]
    assert "turn 0" not in contents
    assert "turn 11" in contents

    # Assistant messages carry their revised source for grounding follow-ups.
    assistant = [m for m in history if m["role"] == "assistant"]
    assert all(m["revised_source"] for m in assistant)

    cleared = client.delete("/ai/forms/form_1/messages", headers=headers)
    assert cleared.json()["count"] == 0
    assert client.get("/ai/forms/form_1/history", headers=headers).json()["messages"] == []


def test_history_requires_ownership(client):
    headers = {"Authorization": "Bearer whatever"}
    # user_b (foreigner) cannot read user_a's form history.
    app.dependency_overrides[get_current_user] = lambda: models.User(id="user_b", email="b@test.com", hashed_password="x")
    resp = client.get("/ai/forms/form_1/history", headers=headers)
    assert resp.status_code == 403
