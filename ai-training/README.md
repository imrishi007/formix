# Formix Forml model training

This folder contains a reproducible Kaggle workflow for fine-tuning a code model to translate requests into Forml, edit existing forms, and repair Forml rejected by the compiler. For the stronger 3B v2 run, follow [KAGGLE_V2.md](KAGGLE_V2.md).

## One flow of work

1. Put a writable checkout of this repository under `/kaggle/working/formix` (copy an attached, read-only Kaggle input there if needed), enable a GPU accelerator, and restart the session. Check the GPU with `!nvidia-smi` and `!python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else torch.version.cuda)"`; Kaggle's available accelerator can vary. If `nvidia-smi` is missing or CUDA is false, do not install/train yet—select GPU under Notebook settings → Accelerator, save, and restart.
2. Install `ai-training/requirements.txt` and run `bash ai-training/run_kaggle.sh` from the repository root. The script checks CUDA first, then compiles the native compiler, creates the dataset, fine-tunes the model, and runs the evaluation.
3. The generated dataset contains request-to-Forml generation, existing-form edit, and compiler-diagnostic repair examples. Edit examples require the model to preserve an existing valid form while adding the requested field. Every target must pass the native compiler before it enters the dataset; each corrupted repair input must fail first.
4. The v2 training script QLoRA fine-tunes `Qwen/Qwen2.5-Coder-3B-Instruct`. It freezes the base model and saves a rank-32 LoRA adapter without overwriting the old output directory.
5. The evaluation script compares the base model and fine-tuned adapter on a deterministic 120-example held-out sample plus independent challenge prompts, uses batched FP16 inference, and measures compiler validity, requested-field coverage, structural intent, and unchanged edits. The compiler decides validity; no external AI service is used as judge.
6. Download the adapter and evaluation report from Kaggle. Later, integrate the adapter-backed model into Formix's existing AI endpoint and retain the same compiler validation loop.

The dataset is synthetic and grammar-grounded. It is useful for a focused student project, but it is not a substitute for human-authored test requests. Review examples and add independently written requests to the test set before reporting final results. Keep train/test requests separated by scenario template when making the final benchmark split.

## Commands

Run from a Kaggle notebook with the repository uploaded and a GPU enabled:

```bash
!pip install -r /kaggle/working/formix/ai-training/requirements.txt
!bash /kaggle/working/formix/ai-training/run_kaggle.sh
```

Set `DATASET_COUNT` before the script to adjust the number of generation examples (the same number of edit and repair examples is added). For example, `!DATASET_COUNT=1200 bash /kaggle/working/formix/ai-training/run_kaggle.sh`.

The scripts have no Groq/OpenAI dependency. Model downloads require internet access in the Kaggle notebook. V2 evaluation loads the 3B model in FP16 and uses batch size 4 on a T4. The one-command workflow and artifact paths are documented in `KAGGLE_V2.md`.

If evaluation reports that preinstalled `torchao` is older than 0.17, remove that optional package with `!pip uninstall -y torchao` and rerun evaluation. This project uses ordinary FP16 inference and does not need TorchAO. The evaluator checks for this Kaggle conflict before starting and saves the base-model report before loading the fine-tuned adapter.

## Local model demo (no website deployment)

For a live demonstration with the existing Next.js editor and local FastAPI
backend, follow [LOCAL_WEBSITE_DEMO.md](LOCAL_WEBSITE_DEMO.md). The steps below
are for a terminal-only demonstration.

The adapter is a PEFT/LoRA delta, not a standalone set of model weights. The first local run downloads the base model from Hugging Face; the adapter zip alone does not include those base weights. With a CUDA-enabled PyTorch environment, the demo loads the base in 4-bit, applies the adapter, generates Forml, compiles it with the native compiler, and sends compiler diagnostics back for up to two repair attempts.

From a Windows PowerShell prompt at the repository root:

```powershell
python -m pip install -r ai-training/requirements.txt
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CUDA PyTorch is required')"
python ai-training/demo_local.py --adapter formix-qlora-adapter.zip --compiler forml-compiler/build/forml_compiler.exe
```

If the native compiler executable is missing, build it from `forml-compiler/` with `build.bat` first. The demo is a local terminal loop; it does not call Groq, Render, or the Formix website.
