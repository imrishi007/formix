<div align="center">

<img src="public/formix.svg" alt="Formix" width="96" height="96" />

# Formix

**Forms as code. Written in FormL, parsed by a hand-written C++ compiler, rendered as a live web UI.**

AI-native forms, compiled — describe what you need, and Formix AI writes it in **FormL**, a real DSL with its own lexer, parser, and semantic analyzer built from scratch and shipped as WebAssembly.

</div>

---

## What is Formix?

Formix is a developer tool for defining forms as code. You write a `.forml` file — a typed DSL for describing fields, validation, layout, and chaining — and Formix compiles it to a JSON AST, validates it semantically, and renders it as a live, interactive form.

- **A real language, not a config blob.** FormL has types, scopes, conditionals, computed fields, and validation rules — checked by a hand-written compiler, not a parser generator.
- **Runs in the browser.** The compiler is C++ compiled to WebAssembly via Emscripten. Source never leaves your machine.
- **Live preview.** Type in the Monaco editor; the compiled form re-renders beside you.
- **Publish to a public link.** Respondents fill your form with no account required.
- **Sequential chaining.** Multiple forms in a project flow A → B → C.

---

## Highlights

| | |
|---|---|
| **FormL DSL** | Fields (`text`, `integer`, `email`, `select`, …), validation, computed fields, conditionals, groups, rows, repeats, dynamic options from URLs |
| **Hand-written compiler** | Recursive-descent parser + semantic analyzer in C++20 → WebAssembly. Zero parser-generator dependencies |
| **Live rendering** | Shared React renderer drives both the IDE preview and the public form page |
| **Formix AI** | In-editor assistant that generates, explains, fixes, and improves FormL |
| **Auth** | Email/password + Google/GitHub OAuth, JWT sessions, password reset via SMTP |
| **Backend** | FastAPI + PostgreSQL (SQLite locally), Alembic migrations, single source of truth for form submissions |

---

## How It Works

Formix is three layers:

| Layer | Stack | Responsibility |
|---|---|---|
| **Compiler** | C++20 → WebAssembly (Emscripten) | Lexes, parses, and semantically validates FormL; emits the JSON AST the frontend consumes. Runs entirely in the browser |
| **Frontend** | Next.js / React / Monaco | Authoring IDE with live preview, public form renderer, publish flow, dashboard |
| **Backend** | FastAPI + PostgreSQL | Auth (JWT + OAuth + reset), form and project storage, submissions, sequential chaining |

The compiler is the single source of truth for Forml semantics — the frontend live preview and the AI assistant both depend on its diagnostics being accurate.

---

## FormL — Quick Reference

`.forml` files describe a form top-to-bottom: variables, groups, pages of fields, and submit actions. Here is a complete example covering most of the language:

```forml
form "Job Application" {

  var base_rate = 0.15 ;

  group address {
    field street: text ui { label: "Street" }
    field city:   text ui { label: "City" }
  }

  page "Personal" {

    field full_name: text ui {
      label: "Full Name"
      placeholder: "Jane Doe"
    } validate {
      required
      maxLength: 100
    }

    field age: integer ui { label: "Age" } validate { min: 18 max: 80 }

    field total: float compute = base_rate * age + 10

    if age >= 18 {
      field occupation: text validate { required }
    } else {
      field guardian: text validate { required }
    }

    field country: select {
      option "India"
      option "USA"
      option "UK"
    }

    field dept: select from url "https://api.example.com/depts" map {
      label: name
      value: id
    }

    row {
      use address
      field zip: text validate { pattern: "^[0-9]{5}$" }
    }

    repeat count = num_jobs {
      field job_title:  text
      field start_year: integer validate { min: 1900 max: 2100 }
    }

    field num_jobs: integer validate { min: 0 max: 10 }

    on load {
      show(occupation)
      hide(guardian)
    }

  }

  action submit {
    endpoint: "https://api.example.com/apply"
    method: POST
  }

}
```

**Field types:** `text`, `integer`, `float`, `email`, `date`, `boolean`, `url`, `select`, `radio`, `checkbox`

**Validation rules:** `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`

**Trigger events:** `load`, `change`, `blur`, `submit`

**Trigger actions:** `hide(id)`, `show(id)`, `clear(id)`, `set(id, value)`, `navigate(url)`, `submit()`

The full language spec lives in [`forml-compiler/EBNF_grammar.md`](forml-compiler/EBNF_grammar.md).

---

## Getting Started

### Prerequisites

- **Node.js 18+** with **pnpm**
- **Python 3.10+**
- **Emscripten** (only for rebuilding the WASM compiler — see [Building the Compiler](#building-the-compiler))

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows · `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill in the values (database URL, JWT secret, SMTP for password reset, OAuth client IDs).

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
pnpm install
pnpm dev
```

Create `.env.local` in the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The frontend runs at `http://localhost:3000`.

---

## Project Structure

```
formix/
├── app/                 Next.js pages (App Router)
│   ├── editor/          Authoring IDE — Monaco editor + live WASM preview
│   ├── f/[formId]/      Public respondent page
│   └── auth/            Login, register, password reset
├── components/
│   ├── form-renderer/   Shared renderer for IDE preview and public page
│   └── brand/           Formix logo, theme toggle, profile menu
├── lib/                 API client, FormL helpers, AI engine
├── backend/             FastAPI service
│   ├── routers/         auth.py, forms.py, projects.py, oauth.py
│   ├── models.py        SQLAlchemy tables: users, projects, forms, submissions
│   └── emailer.py       Password-reset emails over SMTP
├── forml-compiler/      The compiler — C++20 → WebAssembly
│   ├── src/             Lexer, parser, semantic analyzer, JSON serializer, WASM bridge
│   ├── tests/           C++ test drivers + .forml fixtures
│   └── wasm/            Compiled .wasm + JS glue loaded by the frontend
└── public/              Brand assets (formix.svg, favicons)
```

---

## Building the Compiler

The compiler is hand-written C++20 (lexer + recursive-descent parser + semantic analyzer + JSON serializer) compiled to WebAssembly. To build and test natively:

```bash
# From forml-compiler/
g++ -std=c++17 -I include -I third_party \
  src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp \
  src/parser.cpp src/semantic_analyzer.cpp \
  tests/test_parser.cpp -o build/test_parser.exe

# Run from forml-compiler/build/
test_parser.exe
```

For the WASM build (and its JS glue), see `forml-compiler/build.bat`. The compiled `forml.js` / `forml.wasm` live in `public/`.

---

## Tests

- **Compiler** — per-stage C++ test drivers plus `.forml` fixtures (valid and deliberately broken) in `forml-compiler/tests/fixtures/`.
- **Backend** — pytest suite covering auth, OAuth linking, password reset, forms, and submissions:

```bash
cd backend && python -m pytest -q
```

---

## Deployment

- **Frontend** → Vercel. Set `NEXT_PUBLIC_API_URL` to the backend origin.
- **Backend** → Render (or any FastAPI host). Set `DATABASE_URL`, `FORMIX_JWT_SECRET`, `ALLOWED_ORIGINS`, SMTP vars, and OAuth credentials in the dashboard. Reference: [`render.yaml`](render.yaml).
- **Database** → Neon/PostgreSQL with Alembic migrations.

`GET /health` on the backend returns `{"status": "ok", "version": "..."}` — used to confirm deploys.

---

## Key Limitations

- Multi-form chaining is linear (A → B → C), not conditional.
- Unary minus in computed fields (`compute = -5`) is not supported.
- The in-editor "Formix AI" panel generates/explains/fixes/improves FormL — it is currently a hosted-LLM-assisted feature; the editor's `lib/ai-engine.ts` documents the integration seam.

---

## Documentation

- **Compiler internals** — [`forml-compiler/ANALYSIS.md`](forml-compiler/ANALYSIS.md), [`forml-compiler/JSON_SCHEMA.md`](forml-compiler/JSON_SCHEMA.md)
- **Design system** — [`design.md`](design.md)
- **Project architecture** — [`formix-project-architecture.md`](formix-project-architecture.md)

---

<div align="center">

Made with **Formix** — from a sentence to a running form.

</div>
