#!/usr/bin/env bash
# Run from the repository root in a Kaggle GPU notebook after installing
# ai-training/requirements.txt and enabling internet access for model download.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPILER="forml-compiler/build/forml_compiler"
DATA="ai-training/data"
OUTPUT="ai-training/output"
COUNT="${DATASET_COUNT:-1200}"

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
python ai-training/train.py --data "$DATA" --output "$OUTPUT"
python ai-training/evaluate.py --compiler "$COMPILER" --data "$DATA" --adapter "$OUTPUT/adapter" --output "$OUTPUT/evaluation.json"

echo "Training adapter and compiler-evaluated report are in $OUTPUT"
