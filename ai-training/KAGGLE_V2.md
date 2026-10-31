# Train the Formix v2 model on Kaggle

This run trains a new adapter without overwriting the current local model. It
uses `Qwen/Qwen2.5-Coder-3B-Instruct`, compiler-verified generation/edit/repair
examples, twelve independent human-written challenges, and a quality gate.

## 1. Create the notebook

In Kaggle, create a new notebook and set:

- **Accelerator:** GPU T4 x2 if offered; a single T4 or P100 also works.
- **Internet:** On (required once to download the base model and Python packages).
- **Persistence:** Save a notebook version before a long run.

The script currently trains on one GPU. A second T4 is still useful if Kaggle
schedules that accelerator, but the run does not depend on it.

## 2. Get the code

After the v2 branch has been pushed to GitHub, run these cells. Replace
`<v2-branch>` with the branch name supplied with the push.

```bash
!git clone https://github.com/imrishi007/formix.git /kaggle/working/formix
%cd /kaggle/working/formix
!git checkout <v2-branch>
```

If the repository is private, attach a repository ZIP as a Kaggle Dataset,
copy it into `/kaggle/working`, and change into the extracted `formix` folder.
Do not put a GitHub token in a public notebook.

## 3. Install and train

```bash
!pip uninstall -y torchao
!pip install -r ai-training/requirements.txt
!bash ai-training/run_kaggle.sh
```

`run_kaggle.sh` performs the complete run:

1. checks that CUDA is available;
2. builds the native Forml compiler;
3. generates 1,600 creation targets, 1,600 edit targets, and compiler-grounded repair targets;
4. validates every target and all independent challenge references;
5. QLoRA-trains the 3.09B model for two epochs with rank 32 adapters;
6. evaluates the base and fine-tuned model on held-out plus challenge prompts;
7. refuses to publish an adapter that fails compiler and intent thresholds;
8. creates `/kaggle/working/formix/formix-v2-artifacts.zip`.

Expect this to take substantially longer than the old 1.5B run. Do not stop at
the training-loss line: the run is successful only when it prints:

```text
V2 adapter passed its quality gate. Download formix-v2-artifacts.zip
```

## 4. Download and inspect

Download `formix-v2-artifacts.zip` from Kaggle's Files panel. It contains:

- `adapter/` — the PEFT adapter and tokenizer;
- `training_metadata.json` — model, GPU, duration, and loss;
- `evaluation.json` — per-prompt outputs and metrics;
- `quality_gate.json` — the pass/fail decision;
- `dataset_summary.json` — dataset and grammar provenance.

Do not replace the working local adapter if `quality_gate.json` says `false`.
Keep the old adapter until v2 has also passed a local smoke demonstration.

## 5. Test v2 locally

Extract the archive so the adapter is available at
`ai-training/output-v2/adapter`, then run:

```powershell
$env:FORMIX_LOCAL_MODEL_KEY = 'local-demo-only'
python .\ai-training\serve_local.py --adapter .\ai-training\output-v2\adapter
```

The loader reads the correct 3B base-model name from `adapter_config.json`; no
source-code constant needs to be changed. Use the prompts in
`ai-training/challenge.jsonl` for the final local smoke test.
