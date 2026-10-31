#!/usr/bin/env python3
"""Reject a trained adapter unless it is both valid Forml and instruction-faithful."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


LIMITS = {
    "first_pass_compile_rate": (0.90, "min"),
    "compile_rate_after_repairs": (0.97, "min"),
    "mean_field_coverage": (0.95, "min"),
    "mean_required_pattern_coverage": (0.95, "min"),
    "intent_success_rate": (0.85, "min"),
    "unchanged_edit_rate": (0.05, "max"),
}


def evaluate_report(report: dict) -> dict:
    base = report["base_model_results"]
    tuned = report["fine_tuned_results"]
    checks = []
    for metric, (limit, direction) in LIMITS.items():
        value = float(tuned.get(metric, 0.0))
        passed = value >= limit if direction == "min" else value <= limit
        checks.append({"metric": metric, "value": value, "limit": limit, "direction": direction, "passed": passed})

    # Fine-tuning is not allowed to trade instruction-following for syntax.
    # A two-point tolerance accounts for sampling noise in the finite test set.
    for metric in ("first_pass_compile_rate", "intent_success_rate"):
        base_value = float(base.get(metric, 0.0))
        tuned_value = float(tuned.get(metric, 0.0))
        checks.append({
            "metric": f"{metric}_vs_base",
            "value": tuned_value,
            "limit": base_value - 0.02,
            "direction": "min",
            "passed": tuned_value >= base_value - 0.02,
        })

    return {"passed": all(item["passed"] for item in checks), "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    result = evaluate_report(report)
    destination = args.output or args.report.with_name("quality_gate.json")
    destination.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit("Adapter failed the Formix v2 quality gate; do not use or publish it.")


if __name__ == "__main__":
    main()
