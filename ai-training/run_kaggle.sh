#!/usr/bin/env bash
# Run from the repository root in a Kaggle GPU notebook after installing
# ai-training/requirements.txt and enabling internet access for model download.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPILER="forml-compiler/build/forml_compiler"
DATA="ai-training/data-v2"
OUTPUT="ai-training/output-v2"
COUNT="${DATASET_COUNT:-1600}"
MODEL="${FORMIX_BASE_MODEL:-Qwen/Qwen2.5-Coder-3B-Instruct}"

# Fail before compiling or generating thousands of examples if Kaggle started
# a CPU-only session. nvidia-smi is useful for display, but PyTorch's CUDA
# check is the capability the training script itself relies on.
python - <<'PY'
import torch

if not torch.cuda.is_available():
    raise SystemExit(
        "CUDA GPU is unavailable. In Kaggle open Notebook settings, set "
        "Accelerator to GPU, save/restart the session, then rerun the notebook. "
        f"Installed torch: {torch.__version__}; torch.version.cuda={torch.version.cuda}."
    )

print(f"Training GPU: {torch.cuda.get_device_name(0)}")
PY

mkdir -p forml-compiler/build
g++ -std=c++17 -O2 -I forml-compiler/include -I forml-compiler/third_party \
  forml-compiler/src/token.cpp \
  forml-compiler/src/diagnostics.cpp \
  forml-compiler/src/lexer.cpp \
  forml-compiler/src/ast.cpp \
  forml-compiler/src/parser.cpp \
  forml-compiler/src/semantic_analyzer.cpp \
  forml-compiler/src/json_serializer.cpp \
  forml-compiler/src/forml_bridge.cpp \
  forml-compiler/examples/main.cpp \
  -o "$COMPILER"

python ai-training/generate_dataset.py --compiler "$COMPILER" --output "$DATA" --count "$COUNT"
python ai-training/validate_challenges.py --compiler "$COMPILER" --challenge ai-training/challenge.jsonl
python ai-training/train.py \
  --data "$DATA" \
  --output "$OUTPUT" \
  --model "$MODEL" \
  --epochs 2 \
  --learning-rate 1e-4 \
  --max-length 3072 \
  --lora-rank 32
python ai-training/evaluate.py \
  --compiler "$COMPILER" \
  --data "$DATA" \
  --adapter "$OUTPUT/adapter" \
  --model "$MODEL" \
  --challenge ai-training/challenge.jsonl \
  --limit 120 \
  --max-new-tokens 700 \
  --batch-size 4 \
  --output "$OUTPUT/evaluation.json"
python ai-training/quality_gate.py "$OUTPUT/evaluation.json" --output "$OUTPUT/quality_gate.json"

rm -f formix-v2-artifacts.zip
zip -r formix-v2-artifacts.zip \
  "$OUTPUT/adapter" \
  "$OUTPUT/training_metadata.json" \
  "$OUTPUT/evaluation.json" \
  "$OUTPUT/quality_gate.json" \
  "$DATA/dataset_summary.json"

echo "V2 adapter passed its quality gate. Download formix-v2-artifacts.zip"
