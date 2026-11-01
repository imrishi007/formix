import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from repair_guidance import grammar_hints  # noqa: E402


def diagnostic(message: str) -> dict:
    return {"severity": "error", "line": 1, "column": 1, "message": message}


def test_repair_prompt_adds_only_relevant_dialect_hint():
    hints = "\n".join(grammar_hints([diagnostic("Unexpected token '[' in upload block")]))

    assert "accept: pdf,document" in hints
    assert "compute = expression" not in hints
    assert "select from url" not in hints
