#!/usr/bin/env python3
"""Compare base and fine-tuned generation using the Formix compiler as judge."""

from __future__ import annotations

import argparse
import gc
import json
import re
import random
import subprocess
import tempfile
import time
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

from train import BASE_MODEL, SYSTEM_PROMPT


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def compile_source(compiler: Path, source: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".forml", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        path = Path(handle.name)
    try:
        result = subprocess.run([str(compiler), str(path)], capture_output=True, text=True, timeout=20)
    finally:
        path.unlink(missing_ok=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def clean_output(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:forml)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def load_model(model_name: str, adapter: Path | None):
    tokenizer = AutoTokenizer.from_pretrained(str(adapter) if adapter else model_name, use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quantization,
        device_map="auto",
        torch_dtype=torch.float16,
    )
    if adapter:
        model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()
    return model, tokenizer


def generate(model, tokenizer, prompt: str, max_new_tokens: int) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    input_ids = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt").to(model.device)
    with torch.inference_mode():
        output = model.generate(
            input_ids,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    return clean_output(tokenizer.decode(output[0][input_ids.shape[-1]:], skip_special_tokens=True))


def repair_prompt(source: str, diagnostics: list[dict], attempt: int) -> str:
    lines = [
        f"Compiler repair attempt {attempt}. Fix the Forml source so it passes the Formix compiler.",
        "Preserve the requested form and return the complete corrected source only.",
        "Compiler diagnostics:",
    ]
    lines.extend(
        f"line {item.get('line', 0)}, column {item.get('column', item.get('col', 0))}: {item.get('message', 'compiler error')}"
        for item in diagnostics
        if item.get("severity") == "error"
    )
    lines.extend(["Current source:", source])
    return "\n".join(lines)


def run_suite(
    model_name: str,
    adapter: Path | None,
    rows: list[dict],
    compiler: Path,
    max_repairs: int,
    max_new_tokens: int,
    label: str,
) -> dict:
    model, tokenizer = load_model(model_name, adapter)
    records = []
    started = time.monotonic()
    print(f"Evaluating {label}: {len(rows)} examples", flush=True)
    for index, row in enumerate(rows, start=1):
        source = generate(model, tokenizer, row["prompt"], max_new_tokens)
        initial = compile_source(compiler, source)
        initially_valid = bool(initial.get("success"))
        result = initial
        attempts = 0
        while not result.get("success") and attempts < max_repairs:
            attempts += 1
            errors = result.get("diagnostics", [])
            source = generate(model, tokenizer, repair_prompt(source, errors, attempts), max_new_tokens)
            result = compile_source(compiler, source)
        present = set(re.findall(r"\bfield\s+([A-Za-z_]\w*)\s*:", source))
        expected = set(row.get("expected_fields", []))
        coverage = len(present & expected) / len(expected) if expected else 1.0
        records.append({
            "id": row["id"],
            "task": row["task"],
            "scenario": row["scenario"],
            "initial_valid": initially_valid,
            "valid_after_repair": bool(result.get("success")),
            "repair_turns": attempts,
            "field_coverage": coverage,
            "final_diagnostics": result.get("diagnostics", []),
            "generated_source": source,
        })
        if index % 5 == 0 or index == len(rows):
            elapsed = time.monotonic() - started
            print(f"{label}: {index}/{len(rows)} examples in {elapsed / 60:.1f} min", flush=True)
    del model, tokenizer
    gc.collect()
    torch.cuda.empty_cache()
    count = max(1, len(records))
    return {
        "examples": len(records),
        "first_pass_compile_rate": sum(r["initial_valid"] for r in records) / count,
        "compile_rate_after_repairs": sum(r["valid_after_repair"] for r in records) / count,
        "mean_field_coverage": sum(r["field_coverage"] for r in records) / count,
        "repair_success_rate_on_invalid": (
            sum(r["valid_after_repair"] and not r["initial_valid"] for r in records)
            / max(1, sum(not r["initial_valid"] for r in records))
        ),
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("ai-training/data"))
    parser.add_argument("--compiler", type=Path, required=True)
    parser.add_argument("--adapter", type=Path, default=Path("ai-training/output/adapter"))
    parser.add_argument("--model", default=BASE_MODEL)
    parser.add_argument("--output", type=Path, default=Path("ai-training/evaluation.json"))
    parser.add_argument("--max-repairs", type=int, default=2)
    parser.add_argument("--limit", type=int, default=40, help="Examples per model; use 0 for the full test set")
    parser.add_argument("--max-new-tokens", type=int, default=350)
    args = parser.parse_args()
    if not torch.cuda.is_available():
        raise SystemExit("A CUDA GPU is required for model evaluation.")
    rows = read_jsonl(args.data / "test.jsonl")
    if args.limit < 0:
        parser.error("--limit must be 0 (all examples) or a positive number")
    if args.max_new_tokens < 1:
        parser.error("--max-new-tokens must be positive")
    if args.limit and len(rows) > args.limit:
        # Keep the quick evaluation representative without depending on the
        # shuffled JSONL order or taking only the first recipe family.
        rows = random.Random(42).sample(rows, args.limit)
    print(f"Evaluation set: {len(rows)} examples per model; max_new_tokens={args.max_new_tokens}", flush=True)
    report = {
        "compiler": str(args.compiler),
        "base_model": args.model,
        "max_repairs": args.max_repairs,
        "evaluation_examples_per_model": len(rows),
        "max_new_tokens": args.max_new_tokens,
        "base_model_results": run_suite(args.model, None, rows, args.compiler.resolve(), args.max_repairs, args.max_new_tokens, "base model"),
        "fine_tuned_results": run_suite(args.model, args.adapter.resolve(), rows, args.compiler.resolve(), args.max_repairs, args.max_new_tokens, "fine-tuned model"),
        "validation_authority": "native Formix Forml compiler; no hosted AI judge",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for key in ("base_model_results", "fine_tuned_results"):
        result = report[key]
        print(key, json.dumps({k: v for k, v in result.items() if k != "records"}, indent=2))


if __name__ == "__main__":
    main()
