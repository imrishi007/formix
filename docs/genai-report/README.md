# Formix GenAI report workspace

`main.tex` is the report source. The included chart archive currently provides:

- `compile_rates.png`
- `field_coverage.png`

The shortened report includes these two results charts. It omits the table of contents, the redundant dataset-split chart, optional breakdown plots, and the pending training-curve placeholder. Split counts remain in the text, and the methods, results, limitations, and references are retained.

The report uses the recorded 420-example evaluation summary now. The final charts should be generated from the complete evaluation JSON so scenario/task breakdowns come from the actual per-example records.

## Generate figures in Kaggle

To regenerate all charts from the full evaluation JSON, run from the repository root in a Kaggle notebook after the evaluation has saved `ai-training/output/evaluation-full.json`:

```python
%cd /kaggle/working/formix
!pip install matplotlib
!python docs/genai-report/make_figures.py \
  --evaluation ai-training/output/evaluation-full.json \
  --output-dir /kaggle/working/report-figures
```

Download `report-figures` from Kaggle's file browser, then place its PNGs in `docs/genai-report/figures/` in the local repository. The script also writes `overall_metrics.csv`, `scenario_metrics.csv`, and `task_metrics.csv`; keep those with your raw results for reproducibility.

If the Kaggle session still contains a Trainer checkpoint with `trainer_state.json`, the optional training curve can be generated with:

```python
!python docs/genai-report/make_figures.py \
  --evaluation ai-training/output/evaluation-full.json \
  --output-dir /kaggle/working/report-figures \
  --trainer-state ai-training/output/checkpoints/checkpoint-<step>/trainer_state.json
```

Replace `<step>` with the checkpoint directory name. If no trainer state exists, do not invent a training/validation learning curve: the committed training metadata only contains aggregate training loss and runtime.

## Overleaf handoff

Upload `Formix_GenAI_Report_Overleaf_Shortened.zip` from the repository root as a new Overleaf project. Select `main.tex` as the main document and use XeLaTeX. The shortened report was compiled with Tectonic (XeTeX) and visually verified at 6 A4 pages, including references. The original ZIP is preserved. The shortened source is also available in `docs/genai-report/main.tex`.

The quantitative results currently written in the draft are the previously reported full benchmark: 420 examples per model; base first-pass / after-repair compile rates 1.19% / 3.81%; fine-tuned 73.33% / 73.33%; expected-field coverage 29.61% / 93.10%. Recheck these against the exported full evaluation JSON before final submission.
