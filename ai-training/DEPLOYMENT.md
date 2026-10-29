# Serving the fine-tuned Formix model

The Kaggle notebook is a training/demo environment, not a persistent website
inference server. The website's Render backend calls a separately hosted,
OpenAI-compatible endpoint. Vercel and Neon do not host model weights.

## Model serving contract

The trained artifact is a PEFT LoRA adapter, not a standalone model. The
inference service must load `Qwen/Qwen2.5-Coder-1.5B-Instruct` and this adapter,
then expose `POST /v1/chat/completions`. vLLM supports this using the base model,
`--enable-lora`, and a registered adapter, for example:

```bash
vllm serve Qwen/Qwen2.5-Coder-1.5B-Instruct \
  --enable-lora \
  --max-lora-rank 16 \
  --lora-modules formix=<HUGGING_FACE_ADAPTER_REPOSITORY>
```

The adapter repository must contain the extracted PEFT adapter files, including
`adapter_config.json` and `adapter_model.safetensors`. If the repository is
private, the serving host also needs permission to download it. Keep the
inference service's bearer/API key private.

## Connect it to the website

In the Render backend service's Environment settings, set:

| Variable | Value |
| --- | --- |
| `FORMIX_MODEL_BASE_URL` | Inference endpoint base URL ending in `/v1` |
| `FORMIX_MODEL_API_KEY` | Endpoint bearer/API key |
| `FORMIX_MODEL_NAME` | `formix` (the name registered in `--lora-modules`) |
| `FORMIX_MODEL_MAX_TOKENS` | `1200` |

Save the environment changes and let Render restart the backend. Do not put the
endpoint key in Vercel's `NEXT_PUBLIC_*` variables or in browser code. In the
deployed Formix editor, open the AI panel and choose **Fine-tuned Formix** in the
model selector. The existing general assistant remains available as **General
assistant**.

The trained model is specialized for Forml source generation, so this mode
returns code rather than general conversational prose. The client compiles the
source with Formix's WASM compiler; on errors, it sends the actual diagnostics
to the same model for up to two repair attempts. Only compiler-accepted code is
offered as a clean result.

## Costs and availability

The endpoint must stay online and reachable by Render. Kaggle sessions stop and
must not be used as the website's permanent endpoint. GPU inference hosting may
charge while the endpoint is running; check the chosen provider's current
pricing and stop/delete the endpoint when not in use. This repository change
only implements the application integration; endpoint creation and its
credentials require the model owner's hosting account.
