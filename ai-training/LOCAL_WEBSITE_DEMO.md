# Local website + fine-tuned model demonstration

This runs the normal Formix website, FastAPI backend, and your Qwen + Formix
adapter in three local processes. It does not change Render, Vercel, or their
environment variables. The website's existing **Fine-tuned Formix** choice
calls the local model through FastAPI. The backend runs generated Forml through
the native C++ compiler in a separate process and sends real diagnostics back
for up to two repairs before the browser receives any code. This containment is
intentional: malformed model output cannot abort the browser's WASM instance.

## Before the presentation

From the repository root, confirm:

```powershell
nvidia-smi
Test-Path .\ai-training\output\adapter\adapter_config.json
Test-Path .\forml-compiler\build\forml_compiler.exe
python -c "import torch; print('CUDA:', torch.cuda.is_available())"
```

All three checks must succeed. The laptop has an RTX 2050 with 4 GB VRAM;
close other GPU-heavy programs before loading the model. If the native compiler
is missing, run `build.bat` from `forml-compiler/`. The website uses the already
built `public/wasm/forml.wasm`, so Emscripten is not needed for this demo.

Install dependencies once:

```powershell
python -m pip install -r .\backend\requirements.txt
python -m pip install -r .\ai-training\requirements.txt
pnpm install
```

The first run may download `Qwen/Qwen2.5-Coder-1.5B-Instruct` from Hugging
Face. Do that before meeting your professor. The adapter ZIP is not the base
model. If the laptop cannot load it reliably, use a Kaggle GPU for the
terminal-only demo in `ai-training/README.md`; connecting a remote Kaggle
notebook to the local website would require a reachable tunnel and is not part
of this local setup.

## Start the three processes

Open three PowerShell windows at the repository root. Leave each one running.

**Window 1 — local model:**

```powershell
$env:FORMIX_LOCAL_MODEL_KEY = 'local-demo-only'
$env:HF_HUB_OFFLINE = '1' # use after the base model has been downloaded once
$env:TRANSFORMERS_OFFLINE = '1'
python .\ai-training\serve_local.py --adapter .\ai-training\output\adapter
```

Wait for `Formix model ready at http://127.0.0.1:8765/v1`. Check
`http://127.0.0.1:8765/health` for `"status":"ok"`.

**Window 2 — local backend:**

```powershell
$env:DATABASE_URL = 'sqlite:///./backend/formix-demo.db'
$env:FORMIX_MODEL_BASE_URL = 'http://127.0.0.1:8765/v1'
$env:FORMIX_MODEL_API_KEY = 'local-demo-only'
$env:FORMIX_MODEL_NAME = 'formix'
$env:FORMIX_MODEL_MAX_TOKENS = '1200'
$env:FORMIX_COMPILER_PATH = '.\forml-compiler\build\forml_compiler.exe'
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The separate `formix-demo.db` keeps presentation accounts and forms away from
your normal local database. The backend runs Alembic migrations on startup.
If `backend/.env` is absent, copy `backend/.env.example` to `backend/.env` and
set `FORMIX_JWT_SECRET` to a long random value. Do not put a model key in a
`NEXT_PUBLIC_*` variable. Check `http://127.0.0.1:8000/health` for `ok`.

**Window 3 — website:**

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000'
$env:NEXT_PUBLIC_FORMIX_LOCAL_DEMO = '1'
pnpm dev
```

Open `http://localhost:3000`. These environment values apply only to this
PowerShell process. Stop all three processes with Ctrl+C after the demo.

## Verify the whole flow

1. Register or sign in on the local site. Create a project and a form.
2. Open the workspace AI panel and select **Local Formix model**.
3. Ask: `Create a contact form with name, email, and a required message field.`
4. Wait for the model. The panel must show generated Forml and **Syntax verified**.
   The repair count is the number of additional model requests after the first.
5. Click **Insert into Editor**. The live preview should show the requested
   fields, and the diagnostics panel should show no errors.
6. Try an edit: `Add a required phone field and keep the existing fields.`
   Check the editor result and preview again. Generated source is offered for
   insertion; it does not overwrite the editor until you click the button.
7. Try the dynamic case: `Create a dynamic book log. Ask how many books were read, then repeat fields for each book's name, release date, and author.`
   Enter a count in the preview and confirm that the repeated book sections appear.
8. For a negative compiler check, manually remove the colon after a field name
   in the editor. The diagnostics panel should show a line and column error.
   Restore the colon to return to a clean preview.

If generation ends with **Compiler failed**, the panel shows up to three exact
diagnostics and disables **Insert into Editor**. That is a valid demonstration
of the safety boundary, not a successful form generation. Try a shorter prompt
or use **Fix Errors** after placing your own broken source in the editor.

For independent compiler verification, save generated code to `demo.forml`
and run:

```powershell
.\forml-compiler\build\forml_compiler.exe .\demo.forml
```

The JSON result must contain `"success": true` for accepted source. The
browser uses the same compiler logic compiled to WebAssembly.

## If something goes wrong

- `503 Model is still loading`: wait for Window 1 to finish loading.
- `CUDA is unavailable` or out of memory: close GPU-heavy applications,
  confirm CUDA PyTorch, and use the Kaggle terminal demo if 4 GB is insufficient.
- Fine-tuned model unavailable: check the URL, key, and model name in Window 2;
  test Window 1 `/health` first.
- Website calls a remote API: restart Window 3 with `NEXT_PUBLIC_API_URL` set
  before `pnpm dev`.
- `401` from Formix: use the local account in `formix-demo.db`; a production
  session token is not valid for this database.
- Generated code is invalid: read the diagnostics shown under the result and
  the repair count. The editor is protected from applying that candidate.
