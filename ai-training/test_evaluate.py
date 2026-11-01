import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from repair_guidance import grammar_hints, intent_diagnostics  # noqa: E402


def diagnostic(message: str) -> dict:
    return {"severity": "error", "line": 1, "column": 1, "message": message}


def test_repair_prompt_adds_only_relevant_dialect_hint():
    hints = "\n".join(grammar_hints([diagnostic("Unexpected token '[' in upload block")]))

    assert "accept: pdf,document" in hints
    assert "compute = expression" not in hints
    assert "select from url" not in hints


def test_repeat_diagnostics_add_canonical_field_only_example():
    hints = "\n".join(grammar_hints([
        diagnostic("Expected ';' at end of var declaration"),
        diagnostic("Only 'field' declarations are allowed inside a repeat block"),
    ]))

    assert "var book_count = 0 ;" in hints
    assert "repeat count = book_count" in hints
    assert "direct field declarations only" in hints


def test_dynamic_repeat_requires_a_respondent_integer_field():
    problems = intent_diagnostics(
        "Ask for number of books and repeat the book inputs",
        'form "Books" { var book_count = 0 ; repeat count = book_count { field title: text } }',
    )
    assert len(problems) == 1
    assert "integer field" in problems[0]["message"]

    assert intent_diagnostics(
        "Ask for number of books and repeat the book inputs",
        'form "Books" { field book_count: integer repeat count = book_count { field title: text } }',
    ) == []
