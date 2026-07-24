# Formix — Project Audit

Snapshot analysis of the repository as found on disk (not a git repo — no commit history available). Read-only audit; no code, dependencies, or config were changed.

---

## Architecture Summary

Formix is a browser-based IDE for **FormL**, a DSL for defining forms as code. Three layers, as documented in [`README.md`](README.md) and [`formix-project-architecture.md`](formix-project-architecture.md):

| Layer | Stack | Role |
|---|---|---|
| Compiler | Hand-written C++ lexer/parser/semantic-analyzer/JSON-serializer → WebAssembly (Emscripten) | Runs client-side only. `FormL source → JSON AST`. Never runs on the server. |
| Frontend | Next.js 16 / React 19 | Author IDE (Monaco + live preview), public respondent page, marketing/docs site. |
| Backend | FastAPI + SQLite (SQLAlchemy) | Auth (JWT+bcrypt), project/form storage, submissions, sequential form-chaining, outbound webhook firing. |

**Compiler pipeline** ([forml-compiler/src](forml-compiler/src)): `Lexer → Parser → SemanticAnalyzer → JsonSerializer`, unified behind a single entry point `compileForml()` in `forml_bridge.cpp`, exposed to JS via Emscripten embind (`wasm/bindings.cpp`) and loaded at runtime from `public/wasm/forml.js`/`forml.wasm`.

**Frontend flow**: [`lib/use-forml-compiler.ts`](lib/use-forml-compiler.ts) injects the WASM script once and exposes a `compile(source)` function; [`components/editor/demo-ide-shell.tsx`](components/editor/demo-ide-shell.tsx) (1540 lines) is the active IDE at `/editor/demo` — Monaco editor + virtual file system ([`lib/forml-file-system.ts`](lib/forml-file-system.ts)) + live compile-on-keystroke + publish flow. The rendering logic itself lives in the editor-agnostic [`components/form-renderer/index.tsx`](components/form-renderer/index.tsx) (`evalCondition`, `DynamicField`, `RenderStatements`), shared between the IDE's live preview and the public respondent page at [`app/f/[formId]/form-renderer.tsx`](app/f/[formId]/form-renderer.tsx). All backend calls funnel through [`lib/api.ts`](lib/api.ts).

**Backend flow**: `backend/main.py` wires three routers — `auth.py` (register/login), `projects.py` (project + project-scoped form CRUD, form-linking), `forms.py` (public form fetch/submit, author publish/update/responses). Storage is four SQLAlchemy tables (`User → Project → Form → Submission`) in [`backend/models.py`](backend/models.py).

**Monaco integration**: [`lib/monaco-forml-language.ts`](lib/monaco-forml-language.ts) and [`lib/monaco-forml.ts`](lib/monaco-forml.ts) register a custom `forml` language (tokenizer, theme, completions) with the Monaco instance mounted in `demo-ide-shell.tsx`.

**API communication**: single typed client (`lib/api.ts`) wrapping `fetch` against `NEXT_PUBLIC_API_URL`. This is the only sanctioned path per its own doc comment — but see **Broken Integrations** below; it does not actually cover every backend route.

---

## Completed Features

- FormL compiler pipeline (lexer → parser → semantic analyzer → JSON AST), hand-written per [`AGENT.md`](AGENT.md)'s staged build plan. All 6 build stages show complete in [`forml-compiler/ANALYSIS.md`](forml-compiler/ANALYSIS.md), validated against 11 `.forml` fixtures with a documented regression table.
- WASM build + browser-side loading/compile hook (`lib/use-forml-compiler.ts`), with graceful "not yet initialised" and runtime-error states.
- Monaco-based IDE (`demo-ide-shell.tsx`): custom FormL language mode, live diagnostics panel, tabbed virtual file system with 10 sample `.forml` files covering the full grammar.
- Shared, editor-agnostic form renderer (`components/form-renderer/index.tsx`): field types, `ui{}` styling, `validate{}` rules, conditional visibility (`evalCondition`), layout blocks (row/group/repeat).
- Client-side validation hook (`hooks/use-form-validation.ts`) used by the public respondent page.
- Public respondent page (`app/f/[formId]`): fetch compiled schema, render, submit, success/error/not-found states.
- Backend data model and core CRUD: users, projects, forms, submissions; project ownership checks (`_get_project_or_403`, `_get_form_or_403` in `projects.py`); form-linking endpoint (`PATCH /forms/{id}/link`) with self-link and cross-owner rejection.
- JWT auth utilities (`backend/auth.py`): bcrypt hashing (used directly, deliberately bypassing passlib for a documented 5.x-compatibility reason), token creation/decoding, `get_current_user` dependency.
- Fire-and-forget webhook dispatch on submit when a form's `action.endpoint` is set (`_fire_webhook` in `forms.py`).
- Conservative server-side required-field validation that deliberately skips fields nested in conditionals (documented policy, not a bug).
- Docs site (`app/docs/*`) covering grammar, field types, validation, actions, examples.
- Landing page (`components/landing/*`) with AST visualizer and marketing sections.

---

## Partial Features

- **Sequential multi-form chaining** — backend-complete, frontend-absent. The database (`Form.next_form_id`), the link endpoint, session-id minting (`GET /forms/{id}`), `SubmitResponse.next_form_id`/`session_id`, and `GET /submissions/by-session/{id}` are all implemented server-side. But `FormRenderer` (`app/f/[formId]/form-renderer.tsx`) never reads `next_form_id` from the submit response and never redirects; it also never reads or forwards `session_id`. The feature exists only in the backend.
- **Auth** — backend-complete, frontend is a non-functional mockup. `app/auth/signin/page.tsx` and `signup/page.tsx` `handleSubmit` just `await new Promise(r => setTimeout(r, 1200))` — no `fetch` call anywhere in either file. A repo-wide grep for `localStorage`, `Authorization`, `Bearer`, `access_token` across all `.ts`/`.tsx` files returns zero results outside `backend/`. No token is ever requested, stored, or attached to a request.
- **Projects** — backend-complete, no frontend surface. `POST/GET /projects`, `GET /projects/{id}`, `POST /projects/{id}/forms` all exist and are auth-gated, but no component anywhere creates, lists, or selects a project. The IDE's publish flow does not go through a project at all (see next section).
- **Compute expressions** — binary arithmetic (`+ - * /`) with precedence climbing is implemented and guarded against infinite loops on malformed input, but unary minus (`compute = -5`) is an acknowledged grammar gap (`forml-compiler/ANALYSIS.md`, `EBNF_grammar.md`'s `math_factor` rule, and `README.md`'s "Key Limitations").
- **Required-field validation for conditional fields** — intentionally not enforced server-side; the code comment in `forms.py::_get_unconditional_required_fields` documents this as a known, deliberate gap pending a `visible_fields` contract between frontend and backend.

---

## Missing Features

- OAuth, password reset, email verification (README states this explicitly; the signin page even renders a non-functional "Continue with GitHub" button).
- AI / natural-language-to-FormL generation (referenced as a planned, not-built layer in `formix-project-architecture.md`, and `AGENT.md` mentions a separate "AI orchestrator" service that does not exist in this repo).
- Conditional/branching form-to-form routing (chaining is linear by design, and — per above — not even linear-wired on the frontend yet).
- Field-level pre-fill from a prior form's answers in a chained flow (explicitly called out as "a follow-up, not yet implemented" in the architecture doc).
- Any frontend project-management UI.
- Cross-page `navigate()` target validation in the semantic analyzer (explicitly out of scope per `ANALYSIS.md` Stage 4 notes).
- Automated test suite for frontend or backend (see Technical Debt).

---

## Broken Integrations

These are concrete mismatches between what the frontend calls and what the backend serves — not stylistic gaps.

1. **Publish flow calls a route that does not exist.** `lib/api.ts::createForm()` sends `POST /forms`. `backend/routers/forms.py` has no such route — form *creation* only exists at `POST /projects/{project_id}/forms` in `projects.py`, which additionally requires a valid `project_id` and a Bearer token. This is the exact function `demo-ide-shell.tsx:1409` calls on a form's first publish. **Any first-time publish against the real backend will fail** (404/405), which is the single highest-impact defect found in this audit.
2. **Frontend can't reach the project-scoped endpoints even if pointed correctly**, because auth is never wired (see Partial Features) — there is no code path in the frontend capable of producing a Bearer token.
3. **`PublicFormResponse` type drift.** `lib/api.ts`'s `PublicFormResponse` interface omits `session_id`, while the backend's `schemas.PublicFormResponse` and `routers/forms.get_form` both return it. The frontend silently drops the session id it would need for chaining/session correlation.
4. **`submitForm()` never sends `session_id`.** `SubmitRequest.session_id` exists server-side specifically to correlate a respondent's submissions across a chained flow, but `lib/api.ts::submitForm()`'s signature (`id, data`) has no parameter for it and `form-renderer.tsx` never passes one. Every submission is persisted with `respondent_session_id = NULL`, making `GET /submissions/by-session/{id}` unreachable in practice from the current frontend.
5. **Inconsistent auth enforcement within `forms.py` itself.** `PUT /forms/{id}`, `POST /forms/{id}/publish`, and `GET /forms/{id}/responses` have no `get_current_user` dependency and no ownership check — the code comments say so directly ("no auth guard here yet", "Note: ... auth on author routes is a separate TODO"). Any client that discovers a form id can rewrite its source, publish it, or read all of its response data. This is inconsistent with the ownership checks already written and used in `projects.py` (`_get_form_or_403`), which could be reused directly.
6. **Missing `.env.example`.** `README.md` and `backend/auth.py::_get_secret()`'s own runtime error both instruct the developer to "Copy `backend/.env.example` to `backend/.env`" — that file does not exist in the repo. The backend cannot start with a fresh clone until someone reverse-engineers which env vars (`FORMIX_JWT_SECRET`, `FORMIX_JWT_ALGORITHM`, `FORMIX_JWT_EXPIRE_MINUTES`) are required.

---

## Technical Debt

- **No automated tests outside the compiler.** The C++ compiler has real fixture-based regression tests (`forml-compiler/tests/`). There are zero `*.test.*`/`*.spec.*` files anywhere in the frontend or backend, and no `.github/` CI workflows.
- **`demo-ide-shell.tsx` is a 1540-line monolith** mixing Monaco setup, compile orchestration, tab/file management, diagnostics UI, and the publish flow. Worth decomposing before adding the project/auth wiring called for above.
- **`lib/forml-file-system.ts` (1067 lines) appears to hold IDE state purely in memory** — no `localStorage` or backend sync was found for unsaved files, so in-progress editor work not yet published is lost on refresh.
- **CORS is wide open** (`allow_origins=["*"]` in `backend/main.py`), acknowledged in-code as needing tightening before any production deployment.
- **Two parallel editor surfaces**: `/compiler` renders `CompilerPlayground` (`components/editor/compiler-playground.tsx`, 685 lines) while `/editor/demo` renders `DemoIdeShell`. The README's "Project Structure" section documents only the latter; it's unclear whether `CompilerPlayground` is a legacy/testing surface or an intentionally separate lightweight playground.
- **`graphify-out/`** (auto-generated code-graph artifacts, including a `graph.json`/`graph.html`) is checked into the repo root rather than gitignored.
- **Not a git repository** at the audited path — no commit history, blame, or branch state available to cross-reference "recent changes" against these findings.
- **`Database_Handover`** at the repo root is a 0-byte file with no extension — likely an accidental empty commit/placeholder, harmless but worth removing or renaming.

---

## Estimated Completion

| Area | Estimate | Basis |
|---|---|---|
| FormL compiler (lexer/parser/semantic/serializer/WASM) | ~90% | Full pipeline built and regression-tested; only gaps are unary minus and cross-page `navigate()` validation. |
| Backend (models, CRUD, auth utilities, webhooks) | ~75% | Functionally complete but auth enforcement is inconsistent across routers, and setup docs reference a missing `.env.example`. |
| Frontend IDE / editor / live preview | ~70% | Monaco integration, live compile, and preview rendering all work; the publish flow is broken against the real backend (see Broken Integrations #1). |
| Frontend auth & project management | ~10% | UI shells exist; zero functional wiring to the backend. |
| End-to-end author journey (register → project → write → publish → respondent fills → chained flow) | ~30% | Breaks at auth (fake), at first publish (wrong endpoint), and at chaining (never wired). |
| **Overall** | **~55%** | Weighted toward the compiler and renderer being genuinely solid, offset by the publish/auth/chaining path being non-functional end-to-end despite substantial backend work already existing for all three. |

---

## Recommended Implementation Order

1. **Fix the publish path** — point `lib/api.ts::createForm()` at a real endpoint (either call `POST /projects/{project_id}/forms` with a project id, or add a convenience `POST /forms` route server-side if project-less forms should remain supported). This unblocks the entire author flow and is the highest-value single fix in the repo.
2. **Wire real auth** — connect `signin`/`signup` pages to `POST /auth/login` / `POST /auth/register`, persist the returned JWT, and attach it as `Authorization: Bearer` in `lib/api.ts`'s `request()` helper.
3. **Close the auth gap in `forms.py`** — apply the same `_get_form_or_403` pattern already written in `projects.py` to `PUT /forms/{id}`, `POST /forms/{id}/publish`, and `GET /forms/{id}/responses`.
4. **Build minimal project-management UI** (create/list/select a project) — required once #1 and #3 land, since forms will need a project to belong to.
5. **Wire session correlation end-to-end** — capture `session_id` from `getForm()`, thread it through `submitForm()`, and make `FormRenderer` redirect on `next_form_id` to actually deliver the sequential-chaining feature the backend already supports.
6. **Add `backend/.env.example`** so the documented setup steps work on a fresh clone.
7. **Backfill test coverage** for the frontend (publish flow, form rendering, validation) and backend (auth, ownership checks, chaining) — the compiler's fixture-test approach is a good template. Add a minimal CI workflow.
8. **Resolve the unary-minus grammar gap** in the compiler if negative compute literals are meant to be supported (low effort, isolated to `math_factor` parsing).
9. **Cleanup pass**: decide the canonical editor route (`/compiler` vs `/editor/demo`) and remove/relabel the other; decompose `demo-ide-shell.tsx`; gitignore `graphify-out/`; remove the empty `Database_Handover` file.
