#!/usr/bin/env python3
"""Compare base and fine-tuned generation using the Formix compiler as judge."""

from __future__ import annotations

import argparse
import gc
import importlib.metadata
import json
import re
import random
import subprocess
import tempfile
import time
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

from train import BASE_MODEL, SYSTEM_PROMPT


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def check_optional_torchao() -> None:
    """PEFT errors on an old optional Kaggle torchao instead of ignoring it."""
    try:
        installed = importlib.metadata.version("torchao")
    except importlib.metadata.PackageNotFoundError:
        return
    match = re.match(r"^(\d+)\.(\d+)", installed)
    version_pair = tuple(map(int, match.groups())) if match else (0, 0)
    if version_pair < (0, 17):
        raise SystemExit(
            f"Incompatible optional torchao {installed} is preinstalled. "
            "This FP16 evaluation does not use torchao; run `!pip uninstall -y torchao` "
            "in a Kaggle cell, then rerun this evaluation."
        )


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
    # Evaluation uses FP16 weights and batches prompts. The 1.5B base model
    # fits comfortably on a T4, and this avoids the low-throughput, one-prompt
    # at-a-time 4-bit path used during memory-constrained training.
    tokenizer.padding_side = "left"
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        device_map="auto",
        dtype=torch.float16,
    )
    if adapter:
        model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()
    return model, tokenizer


def generate_batch(model, tokenizer, prompts: list[str], max_new_tokens: int) -> list[str]:
    conversations = [
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        for prompt in prompts
    ]
    rendered = tokenizer.apply_chat_template(
        conversations,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(
        rendered,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=4096,
    ).to(model.device)
    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    # Left padding makes each generated continuation start after the shared
    # padded input width; decode each row independently to strip special tokens.
    prompt_width = inputs["input_ids"].shape[1]
    return [
        clean_output(tokenizer.decode(sequence[prompt_width:], skip_special_tokens=True))
        for sequence in output
    ]


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
    batch_size: int,
    label: str,
) -> dict:
    model, tokenizer = load_model(model_name, adapter)
    records = []
    started = time.monotonic()
    print(f"Evaluating {label}: {len(rows)} examples in batches of {batch_size}", flush=True)
    sources: list[str] = []
    results: list[dict] = []
    initially_valid: list[bool] = []
    attempts: list[int] = [0] * len(rows)

    for start in range(0, len(rows), batch_size):
        batch_rows = rows[start:start + batch_size]
        sources.extend(generate_batch(model, tokenizer, [row["prompt"] for row in batch_rows], max_new_tokens))
        for source in sources[start:start + len(batch_rows)]:
            result = compile_source(compiler, source)
            results.append(result)
            initially_valid.append(bool(result.get("success")))
        done = len(sources)
        print(f"{label}: initial compile {done}/{len(rows)}", flush=True)

    # Repair only failed examples, in batches too, so compiler feedback remains
    # per-example while model inference keeps the T4 busy.
    for attempt_no in range(1, max_repairs + 1):
        failed = [i for i, result in enumerate(results) if not result.get("success")]
        if not failed:
            break
        repaired_sources: dict[int, str] = {}
        for start in range(0, len(failed), batch_size):
            batch_indices = failed[start:start + batch_size]
            repair_prompts = [repair_prompt(sources[i], results[i].get("diagnostics", []), attempt_no) for i in batch_indices]
            candidates = generate_batch(model, tokenizer, repair_prompts, max_new_tokens)
            for index, source in zip(batch_indices, candidates):
                repaired_sources[index] = source
        for index, source in repaired_sources.items():
            sources[index] = source
            results[index] = compile_source(compiler, source)
            attempts[index] += 1
        print(f"{label}: repair {attempt_no} checked {len(failed)} examples", flush=True)

    for row, source, result, was_initially_valid, repair_turns in zip(rows, sources, results, initially_valid, attempts):
        present = set(re.findall(r"\bfield\s+([A-Za-z_]\w*)\s*:", source))
        expected = set(row.get("expected_fields", []))
        coverage = len(present & expected) / len(expected) if expected else 1.0
        records.append({
            "id": row["id"],
            "task": row["task"],
            "scenario": row["scenario"],
            "initial_valid": was_initially_valid,
            "valid_after_repair": bool(result.get("success")),
            "repair_turns": repair_turns,
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
    parser.add_argument("--limit", type=int, default=120, help="Examples per model; use 0 for the full test set")
    parser.add_argument("--max-new-tokens", type=int, default=350)
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()
    if not torch.cuda.is_available():
        raise SystemExit("A CUDA GPU is required for model evaluation.")
    check_optional_torchao()
    rows = read_jsonl(args.data / "test.jsonl")
    if args.limit < 0:
        parser.error("--limit must be 0 (all examples) or a positive number")
    if args.max_new_tokens < 1:
        parser.error("--max-new-tokens must be positive")
    if args.batch_size < 1:
        parser.error("--batch-size must be positive")
    if args.limit and len(rows) > args.limit:
        # Keep the quick evaluation representative without depending on the
        # shuffled JSONL order or taking only the first recipe family.
        rows = random.Random(42).sample(rows, args.limit)
    print(f"Evaluation set: {len(rows)} examples per model; batch_size={args.batch_size}; max_new_tokens={args.max_new_tokens}; precision=fp16", flush=True)
    report = {
        "compiler": str(args.compiler),
        "base_model": args.model,
        "max_repairs": args.max_repairs,
        "evaluation_examples_per_model": len(rows),
        "max_new_tokens": args.max_new_tokens,
        "batch_size": args.batch_size,
        "precision": "fp16",
        "validation_authority": "native Formix Forml compiler; no hosted AI judge",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    report["base_model_results"] = run_suite(
        args.model, None, rows, args.compiler.resolve(), args.max_repairs,
        args.max_new_tokens, args.batch_size, "base model",
    )
    # Persist the completed baseline before loading the adapter. If the second
    # model fails to load or runs out of memory, the baseline is still useful.
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    report["fine_tuned_results"] = run_suite(
        args.model, args.adapter.resolve(), rows, args.compiler.resolve(), args.max_repairs,
        args.max_new_tokens, args.batch_size, "fine-tuned model",
    )
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for key in ("base_model_results", "fine_tuned_results"):
        result = report[key]
        print(key, json.dumps({k: v for k, v in result.items() if k != "records"}, indent=2))


if __name__ == "__main__":
    main()
