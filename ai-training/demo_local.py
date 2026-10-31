#!/usr/bin/env python3
"""Run the trained Forml adapter locally and validate it with the native compiler."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

ROOT = Path(__file__).resolve().parents[1]
FALLBACK_BASE_MODEL = "Qwen/Qwen2.5-Coder-3B-Instruct"
SYSTEM_PROMPT = (
    "You write Forml, the Formix form DSL. Return only complete Forml source code. "
    "Use the supplied request and, when present, compiler diagnostics. "
    "Do not invent syntax outside the Forml grammar."
)


def resolve_adapter(path: Path) -> Path:
    """Accept either an extracted PEFT adapter directory or the Kaggle zip."""
    path = path.resolve()
    if path.is_dir():
        if not (path / "adapter_config.json").is_file():
            raise SystemExit(f"Adapter config not found in {path}")
        return path
    if path.suffix.lower() != ".zip" or not path.is_file():
        raise SystemExit(f"Adapter directory or zip not found: {path}")

    destination = ROOT / "ai-training" / "output"
    expected_config = destination / "adapter" / "adapter_config.json"
    if expected_config.is_file():
        return expected_config.parent

    # Only extract files under the known archive prefix; reject path traversal
    # so an externally supplied archive cannot write outside the output folder.
    prefix = "ai-training/output/"
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            if not member.filename.startswith(prefix):
                raise SystemExit(f"Unexpected path in adapter archive: {member.filename}")
            relative = Path(member.filename.removeprefix(prefix))
            if relative.is_absolute() or ".." in relative.parts:
                raise SystemExit(f"Unsafe path in adapter archive: {member.filename}")
        archive.extractall(ROOT)
    if not expected_config.is_file():
        raise SystemExit("The zip did not contain ai-training/output/adapter/adapter_config.json")
    print(f"Extracted adapter to {expected_config.parent}")
    return expected_config.parent


def load_model(adapter_dir: Path):
    if not torch.cuda.is_available():
        raise SystemExit("CUDA is unavailable. Install a CUDA-enabled PyTorch build and check `nvidia-smi`.")

    adapter_config = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    base_model = adapter_config.get("base_model_name_or_path") or FALLBACK_BASE_MODEL
    print(f"Loading {base_model} in 4-bit on {torch.cuda.get_device_name(0)} …", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(adapter_dir, use_fast=True)
    tokenizer.padding_side = "left"
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quantization,
        device_map="auto",
        dtype=torch.float16,
    )
    model = PeftModel.from_pretrained(model, str(adapter_dir))
    model.eval()

    # Instruct checkpoints may ship sampling defaults. We use greedy decoding,
    # so clear sampling-only values to avoid warnings and make runs repeatable.
    model.generation_config.do_sample = False
    model.generation_config.temperature = None
    model.generation_config.top_p = None
    model.generation_config.top_k = None
    return model, tokenizer


def generate(model, tokenizer, user_prompt: str, max_new_tokens: int, system_prompt: str = SYSTEM_PROMPT) -> str:
    conversation = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    inputs = tokenizer.apply_chat_template(
        conversation,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
    ).to(model.device)
    with torch.inference_mode():
        output = model.generate(
            inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(output[0, inputs.shape[1]:], skip_special_tokens=True).strip()
    text = re.sub(r"^```(?:forml)?\s*", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s*```$", "", text).strip()


def compile_source(compiler: Path, source: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".forml", encoding="utf-8", delete=False) as file:
        file.write(source)
        source_path = Path(file.name)
    try:
        result = subprocess.run(
            [str(compiler), str(source_path)],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
    finally:
        source_path.unlink(missing_ok=True)
    return json.loads(result.stdout)


def repair_prompt(source: str, diagnostics: list[dict], attempt: int) -> str:
    errors = [
        f"line {item.get('line', 0)}, column {item.get('column', 0)}: {item.get('message', 'compiler error')}"
        for item in diagnostics
        if item.get("severity") == "error"
    ]
    return (
        f"Repair attempt {attempt}. Correct this Forml so it passes the Formix compiler. "
        "Preserve the requested form and return complete Forml source only.\n\n"
        "Compiler diagnostics:\n" + ("\n".join(errors) or "No specific diagnostic was returned.")
        + "\n\nCurrent Forml source:\n" + source
    )


def answer(model, tokenizer, compiler: Path, request: str, max_repairs: int, max_new_tokens: int) -> None:
    source = generate(model, tokenizer, request, max_new_tokens)
    result = compile_source(compiler, source)
    for attempt in range(1, max_repairs + 1):
        if result.get("success"):
            break
        errors = result.get("diagnostics", [])
        print(f"Compiler rejected output; requesting repair {attempt}/{max_repairs} …", flush=True)
        source = generate(model, tokenizer, repair_prompt(source, errors, attempt), max_new_tokens)
        result = compile_source(compiler, source)

    print("\n--- Generated Forml ---")
    print(source)
    print("--- Compiler result ---")
    print("PASS" if result.get("success") else "FAIL")
    for diagnostic in result.get("diagnostics", []):
        print(
            f"{diagnostic.get('severity', 'error').upper()} "
            f"{diagnostic.get('line', 0)}:{diagnostic.get('column', 0)} "
            f"{diagnostic.get('message', '')}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", type=Path, default=ROOT / "formix-qlora-adapter.zip")
    parser.add_argument("--compiler", type=Path, default=ROOT / "forml-compiler" / "build" / "forml_compiler.exe")
    parser.add_argument("--max-repairs", type=int, default=2)
    parser.add_argument("--max-new-tokens", type=int, default=350)
    parser.add_argument("--prompt", help="Generate one form request and exit (useful in notebooks)")
    args = parser.parse_args()

    compiler = args.compiler.resolve()
    if not compiler.is_file():
        raise SystemExit(f"Native Forml compiler not found: {compiler}. Build it first.")
    adapter_dir = resolve_adapter(args.adapter)
    model, tokenizer = load_model(adapter_dir)
    if args.prompt:
        answer(model, tokenizer, compiler, args.prompt, args.max_repairs, args.max_new_tokens)
        return

    print("Local Formix model ready. Type a form request; type /quit to exit.\n")

    while True:
        try:
            request = input("Form request> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if request.lower() in {"/quit", "/exit"}:
            break
        if not request:
            continue
        answer(model, tokenizer, compiler, request, args.max_repairs, args.max_new_tokens)
        print()


if __name__ == "__main__":
    main()
