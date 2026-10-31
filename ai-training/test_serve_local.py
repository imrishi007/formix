"""Small protocol check for the loopback adapter server, without loading a GPU."""

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent))
import serve_local  # noqa: E402


def test_completion_keeps_backend_prompt_and_requires_key(monkeypatch):
    captured = {}

    def fake_generate(model, tokenizer, prompt, tokens, system):
        captured.update(prompt=prompt, tokens=tokens, system=system)
        return 'form "Demo" {}'

    monkeypatch.setattr(serve_local, "model", object())
    monkeypatch.setattr(serve_local, "tokenizer", object())
    monkeypatch.setattr(serve_local, "demo_key", "test-key")
    monkeypatch.setattr(serve_local, "generate", fake_generate)
    request = serve_local.CompletionRequest(
        model="formix",
        messages=[
            serve_local.Message(role="system", content="Canonical grammar"),
            serve_local.Message(role="user", content="Create a form"),
        ],
        max_tokens=400,
    )

    with pytest.raises(HTTPException) as error:
        serve_local.complete(request, "Bearer wrong-key")
    assert error.value.status_code == 401
    assert serve_local.complete(request, "Bearer test-key")["choices"][0]["message"]["content"] == 'form "Demo" {}'
    assert captured == {"prompt": "Create a form", "tokens": 400, "system": "Canonical grammar"}
