# Formix Forml model training

This folder contains a reproducible Kaggle workflow for fine-tuning a small code model to translate requests into Forml and to repair Forml rejected by the compiler.

## One flow of work

1. Put a writable checkout of this repository under `/kaggle/working/formix` (copy an attached, read-only Kaggle input there if needed), enable a GPU accelerator, and restart the session. Check the GPU with `!nvidia-smi` and `!python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else torch.version.cuda)"`; Kaggle's available accelerator can vary. If `nvidia-smi` is missing or CUDA is false, do not install/train yet—select GPU under Notebook settings → Accelerator, save, and restart.
2. Install `ai-training/requirements.txt` and run `bash ai-training/run_kaggle.sh` from the repository root. The script checks CUDA first, then compiles the native compiler, creates the dataset, fine-tunes the model, and runs the evaluation.
3. The generated dataset contains request-to-Forml examples and compiler-diagnostic repair examples. Every target must pass the native compiler before it enters the dataset; each corrupted repair input must fail first.
4. The training script QLoRA fine-tunes `Qwen/Qwen2.5-Coder-1.5B-Instruct`. It freezes the base model and saves the LoRA adapter.
5. The evaluation script compares the base model and fine-tuned adapter on a deterministic 120-example sample, uses batched FP16 inference (batch size 8), reports progress after each batch, and checks success before repair and after up to two compiler-feedback repair turns. Use `--limit 0` for the full held-out set. The compiler decides validity; no external AI service is used for validation.
6. Download the adapter and evaluation report from Kaggle. Later, integrate the adapter-backed model into Formix's existing AI endpoint and retain the same compiler validation loop.

The dataset is synthetic and grammar-grounded. It is useful for a focused student project, but it is not a substitute for human-authored test requests. Review examples and add independently written requests to the test set before reporting final results. Keep train/test requests separated by scenario template when making the final benchmark split.

## Commands

Run from a Kaggle notebook with the repository uploaded and a GPU enabled:

```bash
!pip install -r /kaggle/working/formix/ai-training/requirements.txt
!bash /kaggle/working/formix/ai-training/run_kaggle.sh
```

Set `DATASET_COUNT` before the script to adjust the number of generation examples (the same number of repair examples is added). For example, `!DATASET_COUNT=1200 bash /kaggle/working/formix/ai-training/run_kaggle.sh`.

The scripts have no Groq/OpenAI dependency. Model downloads require internet access in the Kaggle notebook. Evaluation loads the 1.5B model in FP16 and batches prompts to use the T4 more effectively; it does not reserve unused VRAM. To run the complete held-out set after the 120-example evaluation, use `!python ai-training/evaluate.py --compiler forml-compiler/build/forml_compiler --data ai-training/data --adapter ai-training/output/adapter --limit 0 --batch-size 8 --output ai-training/output/evaluation-full.json`.
