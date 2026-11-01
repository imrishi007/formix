#!/usr/bin/env bash
# Recheck an existing adapter after inference-contract or evaluator fixes.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPILER="forml-compiler/build/forml_compiler"
DATA="ai-training/data-v2"
OUTPUT="ai-training/output-v2"
ARCHIVE="formix-v2-artifacts.zip"

python ai-training/evaluate.py \
  --compiler "$COMPILER" \
  --data "$DATA" \
  --adapter "$OUTPUT/adapter" \
  --model "Qwen/Qwen2.5-Coder-3B-Instruct" \
  --challenge ai-training/challenge.jsonl \
  --limit 120 \
  --max-new-tokens 700 \
  --batch-size 4 \
  --adapter-only \
  --output "$OUTPUT/evaluation.json"
evaluation_status=$?

gate_status=1
if (( evaluation_status == 0 )); then
  python ai-training/quality_gate.py "$OUTPUT/evaluation.json" --output "$OUTPUT/quality_gate.json"
  gate_status=$?
fi

rm -f "$ARCHIVE"
zip -r "$ARCHIVE" \
  "$OUTPUT/adapter" \
  "$OUTPUT/training_metadata.json" \
  "$OUTPUT/evaluation.json" \
  "$OUTPUT/quality_gate.json" \
  "$DATA/dataset_summary.json" \
  "$DATA/test.jsonl" \
  "ai-training/challenge.jsonl"
echo "Updated $ROOT/$ARCHIVE"

(( evaluation_status == 0 )) || exit "$evaluation_status"
exit "$gate_status"
