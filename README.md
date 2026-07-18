# Formix

A browser-based IDE for **FormL**, a DSL for defining forms as code. Authors write FormL, see a live preview, and publish forms to a public link. Respondents fill forms without an account. Multiple forms in a project can be chained sequentially.

---

## How It Works

Formix has three layers:

| Layer | Stack | Does |
|---|---|---|
| Compiler | C++ → WebAssembly | Parses FormL, outputs a JSON schema. Runs in the browser, never on the server. |
| Frontend | Next.js 16 / React 19 | Author IDE with live preview, public form renderer, publish flow. |
| Backend | FastAPI + SQLite | Auth, form storage, submission storage, sequential chaining. |

---

## FormL — Quick Reference

FormL files use the `.forml` extension. Here is a complete example covering most of the language:

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

---

## Running Locally

**Backend**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Copy `backend/.env.example` to `backend/.env` and fill in values before starting.

**Frontend**

```bash
pnpm install
pnpm dev
```

Create a `.env.local` in the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The frontend runs on `http://localhost:3000`.

---

## Project Structure

```
app/
  editor/          Author IDE (Monaco + live WASM preview)
  f/[formId]/      Public respondent page
  auth/            Login and register
components/
  form-renderer/   Shared renderer used by both the IDE preview and public page
backend/
  routers/         auth.py, forms.py, projects.py
  models.py        SQLAlchemy tables: users, projects, forms, submissions
forml-compiler/
  src/             Lexer, parser, semantic analyzer, JSON serializer, WASM bridge
  tests/           C++ test drivers and 11 .forml fixtures
  wasm/            Compiled .wasm + JS glue loaded by the frontend
lib/
  api.ts           All backend calls go through here
```

---

## Building the Compiler

The compiler is C++ compiled to WebAssembly via Emscripten. To build and test natively:

```bash
# From forml-compiler/
g++ -std=c++17 -I include -I third_party \
  src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp \
  src/parser.cpp src/semantic_analyzer.cpp \
  tests/test_parser.cpp -o build/test_parser.exe

# Run from forml-compiler/build/
test_parser.exe
```

For the WASM build see `forml-compiler/build.bat`.

---

## Key Limitations

- Auth is email/password + JWT only. No OAuth, no password reset.
- Multi-form chaining is linear (A → B → C), not conditional.
- Unary minus in computed fields (`compute = -5`) is not supported.
- No AI / natural-language-to-FormL generation yet.
