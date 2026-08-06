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

import asyncio
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
def _reset_overrides(monkeypatch):
    """Clear dependency overrides and the DB between tests, default the current
    user to user A, and point _refresh_env() at a nonexistent .env so the real
    backend/.env keys can't leak into tests that monkeypatch the environment."""
    app.dependency_overrides.clear()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)
    monkeypatch.setattr(ai_module, "_ENV_FILE", Path("__no_env_file__"))

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


# ── Fake httpx transports (exercise the real provider-failover chain) ─────────
# The module reads the provider chain from the environment and drives it through
# httpx.AsyncClient, so the failover tests substitute a scripted fake client:
# each POST consumes the next pre-baked response, and every request URL is
# recorded so a test can assert "Gemini was tried first, then Groq".

class _FakeResponse:
    def __init__(self, status_code, text="", json_data=None):
        self.status_code = status_code
        self.text = text
        self.headers = {}
        self._json_data = json_data

    def json(self):
        return self._json_data


class _FakeCompleteClient:
    """Non-streaming transport fake: `async with client` + `await client.post`."""
    def __init__(self, responses):
        self.responses = list(responses)
        self.posts = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        self.posts.append((url, json))
        return self.responses.pop(0)


class _FakeStreamResponse:
    """Streaming HTTP response fake: status + SSE lines (or an error body)."""
    def __init__(self, status_code, lines=None, body=""):
        self.status_code = status_code
        self.text = body
        self._lines = lines or []
        self._body = body

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def aread(self):
        return self._body.encode("utf-8")


class _StreamCtx:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, *exc):
        return False


class _FakeStreamClient:
    """Streaming transport fake: `async with client` + `client.stream(...)`."""
    def __init__(self, responses):
        self.responses = list(responses)
        self.posts = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def stream(self, method, url, headers=None, json=None):
        self.posts.append((url, json))
        return _StreamCtx(self.responses.pop(0))


# A faithful copy of Google's spent-free-tier-quota 429 body (the exact error
# that was surfacing in the app when Gemini's ~20 req/day model cap ran out).
QUOTA_BODY = (
    '[{"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": '
    '"You exceeded your current quota, please check your plan and billing details. '
    'Quota exceeded for metric: generativelanguage.googleapis.com/'
    'generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash"}}]'
)


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


def test_default_groq_model_is_the_stable_12k_tpm_workhorse(monkeypatch):
    """llama-3.3-70b-versatile is the default Groq model (measured live: 12K TPM,
    the largest pool that works on BOTH the streaming and the non-streaming
    paths — llama-3.1-8b-instant is 6K TPM, and groq/compound's 70K is nominal
    because it routes to tiny sub-pools and 413s non-streaming requests over
    ~3.3K tokens). Its TPM rejections are transient and handled by backoff."""
    assert ai_module.DEFAULT_GROQ_MODEL == "llama-3.3-70b-versatile"
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    cfg = ai_module._active_config()
    assert cfg["model"] == "llama-3.3-70b-versatile"


def test_request_too_large_is_a_failover_trigger():
    """A 413 (request too large) is provider-specific: a prompt Groq's tight TPM
    tier rejects can fit another provider's much larger context, so it must be
    treated like the other transient statuses rather than a hard client error."""
    assert ai_module._should_fail_over(413)
    assert not ai_module._should_fail_over(400)  # malformed request is OUR bug
    assert not ai_module._should_fail_over(404)


def test_clip_truncates_and_marks_the_cut():
    assert ai_module._clip("short", 50) == "short"
    out = ai_module._clip("x" * 3000, 2000)
    assert len(out) < 2100
    assert "omitted" in out


def test_build_messages_clips_oversized_history(monkeypatch):
    """Long conversation history (an assistant turn re-attaches the full form
    source, which grows every edit) must be clipped before it is embedded in
    the prompt, so a long chat can't blow a provider's TPM ceiling."""
    from backend.schemas import AiChatRequest

    req = AiChatRequest(
        form_id="form_1",
        user_message="Make it better",
        source="",
        recent_messages=[
            {"role": "user", "content": "u" * 5000, "forml_code": None},
            {"role": "assistant", "content": "made an edit", "forml_code": "f" * 9000},
        ],
    )
    messages = ai_module._build_messages(req, "system")
    # system prompt + context + 2 history + current turn = 5 messages.
    assert len(messages) == 5
    user_content = messages[2]["content"]
    assistant_content = messages[3]["content"]
    assert len(user_content) <= ai_module.HISTORY_MESSAGE_CLIP + 100
    assert "omitted" in user_content
    assert len(assistant_content) <= ai_module.HISTORY_FORM_CODE_CLIP + 400
    assert "omitted" in assistant_content
    # The clipped source is still clearly delimited as the forml code block.
    assert "```forml" in assistant_content
    assert assistant_content.rstrip().endswith("```")


# ── Provider failover (the fix for the persistent Gemini 429) ─────────────────

def test_all_configs_enumerates_the_failover_chain(monkeypatch):
    """Both a Gemini key and a Groq key produce a two-entry chain, Gemini
    first — the ordering the transports rely on to fail over."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    configs = ai_module._all_configs()
    assert [c["api_key"] for c in configs] == ["gem-key", "groq-key"]
    assert "generativelanguage" in configs[0]["base_url"]
    assert "api.groq.com" in configs[1]["base_url"]


def test_all_configs_dedupes_identical_base_and_key(monkeypatch):
    """AI_API_KEY and GEMINI_API_KEY pointing at the same Gemini account must
    not create two entries — the transport would otherwise burn the retry
    budget on the same exhausted quota twice."""
    monkeypatch.setenv("AI_API_KEY", "same-key")
    monkeypatch.setenv("GEMINI_API_KEY", "same-key")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert len(ai_module._all_configs()) == 1


def test_refresh_env_picks_up_a_key_swap_without_a_restart(tmp_path, monkeypatch):
    """backend/main.py loads .env once at import, so a running server keeps the
    OLD key until restarted — the "I added a new GROQ key but still 413" trap.
    _refresh_env() re-reads .env on every config read, so an edit takes effect
    immediately (the new key has fresh rate-limit pools)."""
    env_file = tmp_path / ".env"
    monkeypatch.setattr(ai_module, "_ENV_FILE", env_file)
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    env_file.write_text("GROQ_API_KEY=old-key\n", encoding="utf-8")
    assert ai_module._all_configs()[0]["api_key"] == "old-key"

    # Edit .env while the server is "running" — the next read sees the new key.
    env_file.write_text("GROQ_API_KEY=new-key\n", encoding="utf-8")
    assert ai_module._all_configs()[0]["api_key"] == "new-key"


def test_is_quota_exhausted_distinguishes_quota_from_rate_limit():
    """Google's spent-daily-quota 429 (RESOURCE_EXHAUSTED + 'exceeded your
    current quota') must be treated as a fail-over trigger; a plain per-minute
    rate-limit message must be left to the retry-with-backoff path."""
    quota = _FakeResponse(429, text=QUOTA_BODY)
    assert ai_module._is_quota_exhausted(quota)
    rate_limit = _FakeResponse(429, text='{"error": {"message": "Rate limit reached, retry later"}}')
    assert not ai_module._is_quota_exhausted(rate_limit)
    assert ai_module._is_quota_exhausted(_FakeResponse(429, text="RESOURCE_EXHAUSTED"))
    assert ai_module._is_quota_exhausted(_FakeResponse(429, text="Quota exceeded for metric X"))


def test_complete_fails_over_to_groq_when_gemini_quota_exhausted(monkeypatch):
    """The exact production scenario: Gemini's free-tier daily quota is spent
    (429 RESOURCE_EXHAUSTED), but a Groq key is configured. The non-streaming
    transport must skip the (futile) retries and complete the turn on Groq."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")

    ok_body = {"choices": [{"message": {"content": "hi from groq"}}]}
    created: dict = {}

    def _client(**kw):
        created["client"] = _FakeCompleteClient(
            [_FakeResponse(429, text=QUOTA_BODY), _FakeResponse(200, json_data=ok_body)]
        )
        return created["client"]

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)
    out = asyncio.run(ai_module._call_ai_complete([{"role": "user", "content": "hi"}]))
    assert out == "hi from groq"

    # Gemini was asked first, then the same turn was retried on Groq.
    urls = [url for url, _ in created["client"].posts]
    assert len(urls) == 2
    assert "generativelanguage" in urls[0]
    assert "api.groq.com" in urls[1]


def test_complete_raises_quota_error_when_no_fallback_provider(monkeypatch):
    """With only Gemini configured, a spent quota must still surface the real
    429 message (the pre-failover behaviour), not a generic failure."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")

    def _client(**kw):
        return _FakeCompleteClient([_FakeResponse(429, text=QUOTA_BODY)])

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)
    with pytest.raises(RuntimeError, match="AI API error 429"):
        asyncio.run(ai_module._call_ai_complete([{"role": "user", "content": "hi"}]))


def test_stream_fails_over_to_groq_when_gemini_quota_exhausted(monkeypatch):
    """The streaming transport — the one the chat endpoint actually uses —
    must fail over the same way: a quota-exhausted 429 on the initial POST is
    retried on the next provider, and the streamed tokens arrive from there."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")

    quota = _FakeStreamResponse(429, body=QUOTA_BODY)
    groq_sse = [
        'data: {"choices":[{"delta":{"content":"Hi "},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":"there"},"finish_reason":"stop"}]}',
        "data: [DONE]",
    ]
    ok = _FakeStreamResponse(200, lines=groq_sse)
    created: dict = {}

    def _client(**kw):
        created["client"] = _FakeStreamClient([quota, ok])
        return created["client"]

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)

    async def _collect():
        chunks = []
        async for delta, reason in ai_module._call_ai_stream([{"role": "user", "content": "hi"}]):
            chunks.append((delta, reason))
        return chunks

    chunks = asyncio.run(_collect())
    assert "".join(d for d, _ in chunks) == "Hi there"
    urls = [url for url, _ in created["client"].posts]
    assert len(urls) == 2
    assert "generativelanguage" in urls[0]
    assert "api.groq.com" in urls[1]


def test_stream_fails_over_when_provider_rejects_request_as_too_large(monkeypatch):
    """A generic 413 "request too large" (no TPM mention — a structural size
    rejection) on the primary provider must not hard-fail the turn: the request
    is only too large FOR THAT PROVIDER, so the same turn continues on the
    fallback."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")

    too_large = _FakeStreamResponse(
        413, body='{"error": {"message": "Request Entity Too Large", "code": "request_too_large"}}'
    )
    groq_sse = [
        'data: {"choices":[{"delta":{"content":"Created the form "},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":"with name and age."},"finish_reason":"stop"}]}',
        "data: [DONE]",
    ]
    ok = _FakeStreamResponse(200, lines=groq_sse)
    created: dict = {}

    def _client(**kw):
        created["client"] = _FakeStreamClient([too_large, ok])
        return created["client"]

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)

    async def _collect():
        out = []
        async for chunk, _reason in ai_module._call_ai_stream([]):
            out.append(chunk)
        return "".join(out)

    assert asyncio.run(_collect()) == "Created the form with name and age."
    urls = [url for url, _ in created["client"].posts]
    assert len(urls) == 2
    assert "generativelanguage" in urls[0]
    assert "api.groq.com" in urls[1]


def test_is_tpm_limit_distinguishes_tpm_saturation_from_generic_too_large():
    """A 413 whose body names the tokens-per-minute ceiling is a TRANSIENT
    condition (the bucket refills) and gets a backoff retry; a bare "Request
    Entity Too Large" is structural and only worth a fail-over."""
    tpm = _FakeResponse(413, text=(
        '{"error": {"message": "Request too large for model `llama-3.3-70b-versatile` '
        "in organization `org_x` on tokens per minute (TPM): Limit 12000\"}}"
    ))
    assert ai_module._is_tpm_limit(tpm)
    assert not ai_module._is_tpm_limit(_FakeResponse(413, text="Request Entity Too Large"))
    assert not ai_module._is_tpm_limit(_FakeResponse(429, text="generic rate limit"))


def test_stream_retries_tpm_413_with_backoff_then_succeeds(monkeypatch):
    """The exact reported failure: Gemini's quota is spent, Groq's shared TPM
    pool is momentarily saturated (413 "on tokens per minute"), and the retry
    after the provider's reset completes the turn — instead of hard-failing."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")

    quota = _FakeStreamResponse(429, body=QUOTA_BODY)
    tpm = _FakeStreamResponse(
        413,
        body=('{"error": {"message": "Request too large for model `llama-3.3-70b-versatile` '
              "in organization `org_x` on tokens per minute (TPM): Limit 12000\"}}"),
    )
    tpm.headers = {"Retry-After": "0"}  # no real sleep in tests
    groq_sse = [
        'data: {"choices":[{"delta":{"content":"User name "},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{"content":"and age form ready."},"finish_reason":"stop"}]}',
        "data: [DONE]",
    ]
    ok = _FakeStreamResponse(200, lines=groq_sse)
    created: dict = {}

    def _client(**kw):
        created["client"] = _FakeStreamClient([quota, tpm, ok])
        return created["client"]

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)

    async def _collect():
        out = []
        async for chunk, _reason in ai_module._call_ai_stream([]):
            out.append(chunk)
        return "".join(out)

    assert asyncio.run(_collect()) == "User name and age form ready."
    # Gemini (quota) then Groq twice: the TPM 413, then the retry that lands.
    urls = [url for url, _ in created["client"].posts]
    assert len(urls) == 3
    assert "generativelanguage" in urls[0]
    assert all("api.groq.com" in u for u in urls[1:])


def test_complete_retries_tpm_413_then_succeeds(monkeypatch):
    """The non-streaming transport (used by the corrective fixup retry) must
    back off and retry a transient TPM 413 the same way the streaming path
    does — a fixup on a saturated pool should not hard-fail."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")

    quota = _FakeResponse(429, text=QUOTA_BODY)
    tpm = _FakeResponse(413, text=(
        '{"error": {"message": "Request too large for model `llama-3.3-70b-versatile` '
        "in organization `org_x` on tokens per minute (TPM): Limit 12000\"}}"
    ))
    tpm.headers = {"Retry-After": "0"}
    ok = _FakeResponse(200, json_data={"choices": [{"message": {"content": "fixed"}}]})
    created: dict = {}

    def _client(**kw):
        created["client"] = _FakeCompleteClient([quota, tpm, ok])
        return created["client"]

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", _client)
    out = asyncio.run(ai_module._call_ai_complete([{"role": "user", "content": "hi"}]))
    assert out == "fixed"
    urls = [url for url, _ in created["client"].posts]
    assert len(urls) == 3
    assert "generativelanguage" in urls[0]
    assert all("api.groq.com" in u for u in urls[1:])


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
