# Formix — Project Architecture

## What Formix is

A browser-based IDE for FormL, a custom DSL for defining forms. An
author writes FormL, gets a live preview, and can publish a form to a
public link that respondents fill out — with answers optionally
chained across multiple forms grouped into a project (Overleaf-style:
one project, many form "files").

## The three layers

### 1. Compiler (C++ → WASM)
Hand-written lexer, parser, semantic analyzer, and JSON serializer for
FormL, compiled to WebAssembly via Emscripten. Runs entirely
client-side, inside the author's browser — never on the server. Input:
FormL source text. Output: a compiled JSON schema (the AST) describing
fields, types, conditionals (`when` blocks), sections, layouts, repeat
groups, and an optional submit action (`ast.action.endpoint` /
`ast.action.method`).

This layer is considered done and is explicitly out of scope for
ongoing feature work — new functionality is built around it, not
inside it.

### 2. Frontend (Next.js / React)

**Author-facing:**
- `demo-ide-shell.tsx` — the active editor (`DemoIdeShell`, mounted at
  `/editor/demo`). VSCode-like shell, Monaco editor, live WASM compile
  on keystroke, `PreviewPanel` showing a live-rendered preview. Also
  hosts the Publish button/modal and (in progress) project/form
  management and form-linking controls.
- A separate, simpler `demo-workspace.tsx` component exists but is not
  the active editor — not a build target.

**Respondent-facing:**
- `app/f/[formId]/page.tsx` + `form-renderer.tsx` — a minimal public
  route. No Monaco, no WASM, no editor chrome. Fetches the compiled
  schema from the backend and renders it, handles submission, and
  (with sequential linking) redirects to the next form in a chain,
  carrying a session token via query string.

**Shared:**
- `components/form-renderer/index.tsx` — `evalCondition`,
  `DynamicField`, `RenderStatements`, extracted out of the editor so
  both the author's live preview and the public respondent page render
  forms identically from one code path, not two.
- `lib/api.ts` — single typed client for all backend calls, reads the
  API base URL from `NEXT_PUBLIC_API_URL`. All frontend code goes
  through this — no component should hardcode the backend URL
  directly.

### 3. Backend (FastAPI + SQLite)

Runs as a separate process/port from the Next.js frontend. Owns:
accounts and auth (JWT), projects, form storage (source + compiled
schema + publish state), submission storage, sequential-chain session
correlation, and forwarding submitted data to an external endpoint
when a form's action block specifies one. See the database
architecture doc for the full schema.

The backend never runs the FormL compiler — it only ever stores and
serves whatever compiled JSON the frontend already produced.

## End-to-end flow (author's perspective)

1. Register / log in.
2. Create a project.
3. Inside the project, create one or more forms; write FormL for each
   in the editor, see live preview.
4. Optionally link Form A → Form B (sequential chaining) via the
   editor's link control.
5. Publish each form — this compiles it one final time and stores the
   result server-side, returning a public link + embed snippet.

## End-to-end flow (respondent's perspective)

1. Opens the public link for Form A (no account, no login).
2. Backend mints a session token on first load.
3. Fills and submits Form A.
   - Submission stored in the backend.
   - If Form A has an `on submit -> POST <url>` action, backend
     forwards the data to that external URL in the background.
   - If Form A links to Form B, respondent is redirected to Form B's
     public URL with the same session token attached.
4. Fills and submits Form B — same storage/forwarding behavior, now
   correlated to Form A's submission via the shared session token.
5. The author can later pull every submission for a given session to
   see one respondent's full multi-form journey.

## Deliberate scope boundaries

- **No AI generation layer yet** (natural-language → FormL). Planned,
  not built.
- **SQLite, not Postgres/Mongo.** Chosen for simplicity at current
  scale (single developer, 6-week window); the relational shape of the
  data (users → projects → forms → submissions, plus form-to-form
  links) fits SQL naturally, and the upgrade path if ever needed is
  Postgres, not a document store.
- **Session-based chaining is linear, not branching.** A → B → C, not
  conditional routing between forms. Field-level pre-fill from a prior
  form's answers is a follow-up, not yet implemented — the data is
  made available via the backend, but the renderer doesn't yet act on
  it automatically.
- **Auth is deliberately minimal.** Email/password + JWT only. No
  OAuth, no password reset flow, no email verification — sufficient
  for a working demo, not for production use.
