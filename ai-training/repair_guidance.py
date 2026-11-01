"""Small, compiler-triggered reminders for dialect mistakes seen in evaluation."""

import re


def intent_diagnostics(request: str, source: str) -> list[dict]:
    """Catch compiler-valid repeats that cannot be controlled by the respondent."""
    asks_for_count = re.search(
        r"\b(how many|number|count|entered|ask(?:ing)?|input)\b",
        request,
        flags=re.IGNORECASE,
    )
    if not asks_for_count:
        return []
    diagnostics = []
    for count_name in re.findall(r"\brepeat\s+count\s*=\s*([A-Za-z_]\w*)", source):
        if not re.search(
            rf"\bfield\s+{re.escape(count_name)}\s*:\s*integer\b",
            source,
        ):
            diagnostics.append({
                "severity": "error",
                "line": 0,
                "column": 0,
                "message": (
                    f"Requested respondent-entered repeat count '{count_name}' "
                    "must be declared as an integer field, not a fixed var."
                ),
            })
    return diagnostics


def grammar_hints(diagnostics: list[dict]) -> list[str]:
    messages = " ".join(str(item.get("message", "")) for item in diagnostics).lower()
    hints: list[str] = []
    if "upload block" in messages or "accept value" in messages or "unexpected character '['" in messages:
        hints.extend([
            'Canonical upload example: field resume: upload { accept: pdf,document required maxSize: "10MB" }',
            "Do not use MIME arrays, max_size, or byte arithmetic.",
        ])
    if "after 'compute'" in messages or "math expression" in messages:
        hints.extend([
            "Canonical computed field: field total: float compute = quantity * unit_price",
            "Use compute = expression, never compute braces.",
        ])
    if "inside select" in messages or "source block" in messages:
        hints.extend([
            'Canonical dynamic select: field department: select from url "https://example.invalid/departments" map { label: name, value: id }',
            "Use from url and map; never use a load block or add a repair field.",
        ])
    if "end of var declaration" in messages:
        hints.extend([
            "Canonical variable declaration: var book_count = 0 ;",
            "Every var declaration ends with a semicolon.",
        ])
    if "only 'field' declarations are allowed inside a repeat block" in messages:
        hints.extend([
            'Canonical repeat: repeat count = book_count { field book_name: text ui { label: "Book name" } field release_date: date ui { label: "Release date" } field author: text ui { label: "Author" } }',
            "A repeat block contains direct field declarations only; never use row, label assignments, or input syntax.",
        ])
    if "respondent-entered repeat count" in messages:
        hints.extend([
            'Canonical user-controlled count: field book_count: integer ui { label: "Number of books" } validate { required min: 1 max: 20 }',
            "Use that integer field in repeat count = book_count; never use a fixed var for a count the respondent enters.",
        ])
    return hints
