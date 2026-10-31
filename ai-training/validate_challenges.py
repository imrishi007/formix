#!/usr/bin/env python3
"""Validate independent evaluation references before spending GPU time."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path


def compile_source(compiler: Path, source: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".forml", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        source_path = Path(handle.name)
    try:
        run = subprocess.run([str(compiler), str(source_path)], capture_output=True, text=True, timeout=20)
    finally:
        source_path.unlink(missing_ok=True)
    if run.returncode:
        raise RuntimeError(run.stderr.strip() or "compiler process failed")
    return json.loads(run.stdout)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", required=True, type=Path)
    parser.add_argument("--challenge", type=Path, default=Path("ai-training/challenge.jsonl"))
    args = parser.parse_args()
    compiler = args.compiler.resolve()
    rows = [json.loads(line) for line in args.challenge.read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = [row["id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("Challenge IDs must be unique.")
    for row in rows:
        source = row["completion"]
        result = compile_source(compiler, source)
        if not result.get("success"):
            raise SystemExit(f"{row['id']} reference failed compiler: {result.get('diagnostics')}")
        present = set(re.findall(r"\bfield\s+([A-Za-z_]\w*)\s*:", source))
        missing = set(row.get("expected_fields", [])) - present
        if missing:
            raise SystemExit(f"{row['id']} reference is missing expected fields: {sorted(missing)}")
        for pattern in row.get("required_patterns", []):
            if not re.search(pattern, source, flags=re.MULTILINE):
                raise SystemExit(f"{row['id']} reference does not match required pattern: {pattern}")
    print(json.dumps({"challenge_examples": len(rows), "compiler_verified": len(rows)}, indent=2))


if __name__ == "__main__":
    main()
