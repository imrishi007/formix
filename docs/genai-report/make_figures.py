#!/usr/bin/env python3
"""Create report charts and CSV summaries from ai-training/evaluate.py JSON."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


MODEL_KEYS = ("base_model_results", "fine_tuned_results")
LABELS = ("Base model", "Fine-tuned")
COLORS = ("#718096", "#2878B5")


def read_report(path: Path) -> dict:
    report = json.loads(path.read_text(encoding="utf-8"))
    missing = [key for key in MODEL_KEYS if key not in report]
    if missing:
        raise SystemExit(f"Evaluation JSON is missing: {', '.join(missing)}")
    for key in MODEL_KEYS:
        if not report[key].get("records"):
            raise SystemExit(f"{key} has no per-example records; use the full evaluator output JSON.")
    return report


def save_csv(path: Path, headers: list[str], rows: list[list[object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(rows)


def make_figures(report: dict, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    results = [report[key] for key in MODEL_KEYS]

    # Overall compiler success is the primary objective metric. Keep initial
    # and post-repair rates side by side so repairs cannot hide poor first drafts.
    fig, ax = plt.subplots(figsize=(8.2, 4.8))
    x = [0, 1]
    width = 0.34
    first = [100 * item["first_pass_compile_rate"] for item in results]
    repaired = [100 * item["compile_rate_after_repairs"] for item in results]
    b1 = ax.bar([i - width / 2 for i in x], first, width, label="First pass", color="#2878B5")
    b2 = ax.bar([i + width / 2 for i in x], repaired, width, label="After up to 2 repairs", color="#E07A2D")
    ax.bar_label(b1, fmt="%.1f%%", padding=3)
    ax.bar_label(b2, fmt="%.1f%%", padding=3)
    ax.set_xticks(x, LABELS)
    ax.set_ylabel("Compiler acceptance (%)")
    ax.set_ylim(0, 110)
    ax.set_title(f"Compiler acceptance (n={report.get('evaluation_examples_per_model', len(results[0]['records']))} per model)")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(output / "compile_rates.png", dpi=220)
    plt.close(fig)

    coverage = [100 * item["mean_field_coverage"] for item in results]
    fig, ax = plt.subplots(figsize=(6.8, 4.6))
    bars = ax.bar(LABELS, coverage, color=COLORS, width=0.56)
    ax.bar_label(bars, fmt="%.1f%%", padding=4)
    ax.set_ylabel("Expected field identifiers found (%)")
    ax.set_ylim(0, 110)
    ax.set_title("Mean expected-field coverage")
    ax.text(0.5, -0.20, "Lexical identifier overlap; not a semantic correctness score.", transform=ax.transAxes,
            ha="center", fontsize=8, color="#555555")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(output / "field_coverage.png", dpi=220, bbox_inches="tight")
    plt.close(fig)

    scenario_rows: list[list[object]] = []
    by_model_scenario: list[dict[str, dict[str, list[dict]]]] = []
    for result in results:
        groups: dict[str, list[dict]] = defaultdict(list)
        for record in result["records"]:
            groups[str(record.get("scenario", "unspecified"))].append(record)
        by_model_scenario.append(groups)
    scenarios = sorted(set(by_model_scenario[0]) | set(by_model_scenario[1]))
    fig, ax = plt.subplots(figsize=(max(9.0, 1.5 * len(scenarios)), 5.0))
    positions = list(range(len(scenarios)))
    width = 0.36
    for model_index, groups in enumerate(by_model_scenario):
        rates = []
        for scenario in scenarios:
            records = groups.get(scenario, [])
            rate = 100 * sum(bool(row.get("initial_valid")) for row in records) / len(records) if records else 0
            rates.append(rate)
            scenario_rows.append([
                LABELS[model_index], scenario, len(records),
                f"{rate:.4f}",
                f"{100 * sum(bool(row.get('valid_after_repair')) for row in records) / len(records):.4f}" if records else "",
                f"{100 * sum(float(row.get('field_coverage', 0)) for row in records) / len(records):.4f}" if records else "",
            ])
        offset = (model_index - 0.5) * width
        bars = ax.bar([pos + offset for pos in positions], rates, width, label=LABELS[model_index], color=COLORS[model_index])
        ax.bar_label(bars, fmt="%.0f", padding=2, fontsize=7)
    ax.set_xticks(positions, scenarios, rotation=25, ha="right")
    ax.set_ylabel("First-pass compiler acceptance (%)")
    ax.set_ylim(0, 110)
    ax.set_title("First-pass compiler acceptance by scenario")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(output / "scenario_breakdown.png", dpi=220)
    plt.close(fig)
    save_csv(output / "scenario_metrics.csv",
             ["model", "scenario", "n", "first_pass_compile_percent", "after_repair_compile_percent", "field_coverage_percent"],
             scenario_rows)

    # This view makes clear which training task category drives performance.
    task_rows: list[list[object]] = []
    by_model_task: list[dict[str, list[dict]]] = []
    for result in results:
        groups: dict[str, list[dict]] = defaultdict(list)
        for record in result["records"]:
            groups[str(record.get("task", "unspecified"))].append(record)
        by_model_task.append(groups)
    tasks = sorted(set(by_model_task[0]) | set(by_model_task[1]))
    fig, ax = plt.subplots(figsize=(7.5, 4.8))
    positions = list(range(len(tasks)))
    for model_index, groups in enumerate(by_model_task):
        rates = []
        for task in tasks:
            records = groups.get(task, [])
            rate = 100 * sum(bool(row.get("initial_valid")) for row in records) / len(records) if records else 0
            rates.append(rate)
            task_rows.append([
                LABELS[model_index], task, len(records), f"{rate:.4f}",
                f"{100 * sum(bool(row.get('valid_after_repair')) for row in records) / len(records):.4f}" if records else "",
                f"{100 * sum(float(row.get('field_coverage', 0)) for row in records) / len(records):.4f}" if records else "",
            ])
        offset = (model_index - 0.5) * width
        bars = ax.bar([pos + offset for pos in positions], rates, width, label=LABELS[model_index], color=COLORS[model_index])
        ax.bar_label(bars, fmt="%.1f%%", padding=3, fontsize=8)
    ax.set_xticks(positions, tasks)
    ax.set_ylabel("First-pass compiler acceptance (%)")
    ax.set_ylim(0, 110)
    ax.set_title("First-pass results by task label")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(output / "task_breakdown.png", dpi=220)
    plt.close(fig)
    save_csv(output / "task_metrics.csv",
             ["model", "task", "n", "first_pass_compile_percent", "after_repair_compile_percent", "field_coverage_percent"],
             task_rows)

    summary_rows = []
    for label, result in zip(LABELS, results):
        summary_rows.append([
            label, result["examples"],
            f"{100 * result['first_pass_compile_rate']:.4f}",
            f"{100 * result['compile_rate_after_repairs']:.4f}",
            f"{100 * result['mean_field_coverage']:.4f}",
            f"{100 * result['repair_success_rate_on_invalid']:.4f}",
        ])
    save_csv(output / "overall_metrics.csv",
             ["model", "examples", "first_pass_compile_percent", "after_repair_compile_percent", "mean_field_coverage_percent", "repair_rescue_on_invalid_percent"],
             summary_rows)


def make_training_curve(trainer_state: Path, output: Path) -> None:
    """Plot logged Trainer losses when Kaggle retained trainer_state.json."""
    state = json.loads(trainer_state.read_text(encoding="utf-8"))
    history = state.get("log_history", [])
    train_points = [(row.get("step"), row.get("loss")) for row in history if row.get("loss") is not None]
    eval_points = [(row.get("step"), row.get("eval_loss")) for row in history if row.get("eval_loss") is not None]
    if not train_points and not eval_points:
        raise SystemExit(f"No logged loss values found in {trainer_state}")
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    if train_points:
        ax.plot([point[0] for point in train_points], [point[1] for point in train_points],
                marker=".", linewidth=1.2, label="Training loss", color="#2878B5")
    if eval_points:
        ax.plot([point[0] for point in eval_points], [point[1] for point in eval_points],
                marker="o", linewidth=1.5, label="Validation loss", color="#E07A2D")
    ax.set_xlabel("Training step")
    ax.set_ylabel("Loss")
    ax.set_title("Fine-tuning loss history")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(output / "training_loss.png", dpi=220)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evaluation", type=Path, required=True, help="Path to full evaluator JSON")
    parser.add_argument("--output-dir", type=Path, default=Path("docs/genai-report/figures"))
    parser.add_argument("--trainer-state", type=Path, help="Optional Transformers trainer_state.json for loss curves")
    args = parser.parse_args()
    report = read_report(args.evaluation)
    make_figures(report, args.output_dir)
    print(f"Charts and CSV summaries written to {args.output_dir.resolve()}")
    print("Created: compile_rates.png, field_coverage.png, scenario_breakdown.png, task_breakdown.png")
    if args.trainer_state:
        make_training_curve(args.trainer_state, args.output_dir)
        print("Created: training_loss.png")


if __name__ == "__main__":
    main()
