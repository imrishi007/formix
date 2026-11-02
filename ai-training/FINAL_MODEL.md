# Final Formix v2 model

The accepted demonstration model is a QLoRA adapter for
`Qwen/Qwen2.5-Coder-3B-Instruct`. It passed the Formix quality gate on 132
held-out examples.

## Accepted evaluation

| Metric | Result |
|---|---:|
| First-pass compile rate | 96.97% |
| Compile rate after repair | 97.73% |
| Mean field coverage | 99.62% |
| Mean field precision | 99.62% |
| Exact field-set rate | 99.24% |
| Required-pattern coverage | 96.21% |
| Intent success rate | 95.45% |
| Unchanged-edit rate | 0% |

The machine-readable evidence is committed in:

- `output-v2/training_metadata.json`
- `output-v2/evaluation.json`
- `output-v2/quality_gate.json`
- `data-v2/dataset_summary.json`

## Weights

The recoverable local package is `formix-v2-passed-artifacts.zip`. It is
intentionally ignored by Git because its 214 MB compressed size exceeds
GitHub's normal 100 MB per-file limit. The same passing adapter is attached as
the Formix Kaggle Model used by the demo notebooks.

Failed v2 artifacts, the obsolete v1 adapter, extracted duplicate weights,
generated test data, and training caches are not retained.
