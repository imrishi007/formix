# Formix Forml model training

This folder contains a reproducible Kaggle workflow for fine-tuning a small code model to translate requests into Forml and to repair Forml rejected by the compiler.

## One flow of work

1. Put a writable checkout of this repository under `/kaggle/working/formix` (copy an attached, read-only Kaggle input there if needed), enable a GPU accelerator, and check the actual GPU with `nvidia-smi`; Kaggle's available accelerator can vary.
2. Install `ai-training/requirements.txt` and run `bash ai-training/run_kaggle.sh` from the repository root. The script compiles the native compiler, creates the dataset, fine-tunes the model, and runs the evaluation.
3. The generated dataset contains request-to-Forml examples and compiler-diagnostic repair examples. Every target must pass the native compiler before it enters the dataset; each corrupted repair input must fail first.
4. The training script QLoRA fine-tunes `Qwen/Qwen2.5-Coder-1.5B-Instruct`. It freezes the base model and saves the LoRA adapter.
5. The evaluation script compares the base model and fine-tuned adapter before repair and after up to two compiler-feedback repair turns. The compiler decides validity; no external AI service is used for validation.
6. Download the adapter and evaluation report from Kaggle. Later, integrate the adapter-backed model into Formix's existing AI endpoint and retain the same compiler validation loop.

The dataset is synthetic and grammar-grounded. It is useful for a focused student project, but it is not a substitute for human-authored test requests. Review examples and add independently written requests to the test set before reporting final results. Keep train/test requests separated by scenario template when making the final benchmark split.

## Commands

Run from a Kaggle notebook with the repository uploaded and a GPU enabled:

```bash
!pip install -r /kaggle/working/formix/ai-training/requirements.txt
!bash /kaggle/working/formix/ai-training/run_kaggle.sh
```

Set `DATASET_COUNT` before the script to adjust the number of generation examples (the same number of repair examples is added). For example, `!DATASET_COUNT=1200 bash /kaggle/working/formix/ai-training/run_kaggle.sh`.

The scripts have no Groq/OpenAI dependency. Model downloads require internet access in the Kaggle notebook.
