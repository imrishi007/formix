import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from quality_gate import evaluate_report  # noqa: E402


def metrics(**overrides):
    values = {
        "first_pass_compile_rate": 0.95,
        "compile_rate_after_repairs": 0.99,
        "mean_field_coverage": 0.98,
        "mean_required_pattern_coverage": 0.97,
        "intent_success_rate": 0.90,
        "unchanged_edit_rate": 0.01,
    }
    values.update(overrides)
    return values


def test_quality_gate_accepts_a_strong_non_regressing_adapter():
    result = evaluate_report({
        "base_model_results": metrics(first_pass_compile_rate=0.91, intent_success_rate=0.84),
        "fine_tuned_results": metrics(),
    })
    assert result["passed"] is True


def test_quality_gate_rejects_valid_code_that_ignores_prompts():
    result = evaluate_report({
        "base_model_results": metrics(intent_success_rate=0.80),
        "fine_tuned_results": metrics(intent_success_rate=0.60),
    })
    assert result["passed"] is False
    failed = {item["metric"] for item in result["checks"] if not item["passed"]}
    assert "intent_success_rate" in failed
