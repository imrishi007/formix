#!/usr/bin/env python3
"""Serve the Formix LoRA on loopback for the existing website's AI panel.

Run this as a separate process. The website's FastAPI backend calls this
OpenAI-compatible endpoint; no model code or credentials enter the browser.
"""

import argparse
import os
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from demo_local import ROOT, generate, load_model, resolve_adapter


class Message(BaseModel):
    role: str
    content: str


class CompletionRequest(BaseModel):
    model: str
    messages: list[Message]
    max_tokens: int = Field(default=600, ge=1, le=2048)


app = FastAPI(title="Formix local model demo")
model = None
tokenizer = None
demo_key = ""


@app.get("/health")
def health():
    if model is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    return {"status": "ok", "model": "formix", "device": torch.cuda.get_device_name(0)}


@app.post("/v1/chat/completions")
def complete(body: CompletionRequest, authorization: str | None = Header(default=None)):
    # The service is loopback-only, but still match the backend's bearer contract.
    if authorization != f"Bearer {demo_key}":
        raise HTTPException(status_code=401, detail="Invalid local demo key")
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    if body.model != "formix":
        raise HTTPException(status_code=404, detail="Use model name 'formix'")
    if not body.messages or body.messages[-1].role != "user" or not body.messages[-1].content.strip():
        raise HTTPException(status_code=422, detail="A user request is required")
    # Preserve the canonical grammar and example in the router's system prompt.
    prompt = body.messages[-1].content
    system_prompt = next((item.content for item in body.messages if item.role == "system"), "")
    # ponytail: a single model process serializes generation. This is enough
    # for one local presenter; use a serving engine when concurrent users matter.
    source = generate(model, tokenizer, prompt, body.max_tokens, system_prompt)
    return {"choices": [{"message": {"role": "assistant", "content": source}, "finish_reason": "stop"}]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", type=Path, default=ROOT / "ai-training" / "output" / "adapter")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    global model, tokenizer, demo_key
    demo_key = os.environ.get("FORMIX_LOCAL_MODEL_KEY", "local-demo-only")
    model, tokenizer = load_model(resolve_adapter(args.adapter))
    print(f"Formix model ready at http://127.0.0.1:{args.port}/v1", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
