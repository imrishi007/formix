# AGENTS.md — Forml C++ Compiler

## Project Context

This is the **C++ compiler component** of Formix (Forms-as-Code) — a developer tool that
defines forms in a custom DSL called **Forml**, version-controls them in Git, and renders
them as live web UIs. This document covers ONLY the `forml-compiler/` subdirectory: the
hand-written lexer, recursive-descent parser, semantic analyzer, JSON serializer, and WASM
bridge that turn `.forml` source text into a JSON AST consumable by the Next.js frontend.

This is a learning-oriented build: no parser generators (no ANTLR, no yacc/bison). Everything
is hand-written on purpose, as an explicit educational and architectural constraint. Do not
suggest or silently substitute a parser-generator approach.

The person building this (Rishi) is learning compiler construction from first principles
alongside building the real thing. Code should be correct AND heavily commented — assume the
reader is encountering lexer/parser concepts for the first time and needs the "why," not just
the "what."

## Relationship to the Rest of Formix

- **Frontend** (Next.js/React + Monaco editor): already largely built. Consumes the JSON AST
  this compiler produces to render live form UIs.
- **AI orchestrator** (FastAPI, self-correction loop): a separate service. Not part of this
  directory. It generates/repairs `.forml` source, which then gets validated by this compiler.
- **This compiler**: the single source of truth for what valid Forml syntax/semantics is.
  Both the frontend live-preview and the AI orchestrator's self-correction loop depend on this
  compiler's diagnostics being accurate and well-formed.

## Build Order — Staged, Sequential, Reviewed

This project is built in strict stages. **Do not build ahead of the current stage** unless
explicitly instructed, even to "set things up" for later. Each stage is built, then reviewed
and understood by Rishi before the next begins.

| Stage | Deliverable | Status |
|-------|-------------|--------|
| 0 | `token.hpp/cpp`, `diagnostics.hpp/cpp`, nlohmann/json setup | _update as completed_ |
| 1 | `lexer.hpp/cpp` — source text → token stream | _update as completed_ |
| 2 | `ast.hpp/cpp` — AST node type definitions | _not started_ |
| 3 | `parser.hpp/cpp` — recursive-descent parser | _not started_ |
| 4 | `semantic_analyzer.hpp/cpp` | _not started_ |
| 5 | `json_serializer.hpp/cpp`, `ast_visitor.hpp` | _not started_ |
| 6 | `forml_bridge.hpp/cpp`, `wasm/bindings.cpp` | _not started_ |

**Update the Status column as stages complete.** When asked to "continue the build," check
this table first and proceed from the first incomplete stage — do not skip ahead.

## Complete File Architecture

```
forml-compiler/
├── CMakeLists.txt
├── include/forml/
│   ├── token.hpp
│   ├── lexer.hpp
│   ├── ast.hpp
│   ├── parser.hpp
│   ├── diagnostics.hpp
│   ├── semantic_analyzer.hpp
│   ├── ast_visitor.hpp
│   ├── json_serializer.hpp
│   └── forml_bridge.hpp
├── src/
│   ├── token.cpp
│   ├── lexer.cpp
│   ├── ast.cpp
│   ├── parser.cpp
│   ├── diagnostics.cpp
│   ├── semantic_analyzer.cpp
│   ├── json_serializer.cpp
│   └── forml_bridge.cpp
├── wasm/
│   └── bindings.cpp
├── tests/
│   ├── test_lexer.cpp
│   ├── test_parser.cpp
│   ├── test_semantic.cpp
│   └── fixtures/
│       ├── valid_*.forml
│       └── invalid_*.forml
├── examples/
│   └── main.cpp
└── third_party/
    └── nlohmann/json.hpp
```

### File responsibilities

- **`token.hpp/cpp`** — `TokenType` enum class (derived exhaustively from the Forml EBNF),
  `Token` struct (`type`, `lexeme`, `line`, `column`), `tokenTypeToString()` debug helper.
- **`diagnostics.hpp/cpp`** — `Severity`, `Diagnostic`, `DiagnosticEngine`. Errors are
  *collected*, not thrown, so a single compile pass can surface multiple problems at once.
- **`lexer.hpp/cpp`** — `Lexer` class. Raw source string → `std::vector<Token>`. Tracks
  line/column for every token. Reports unrecognized characters via `DiagnosticEngine` and
  continues scanning rather than aborting.
- **`ast.hpp/cpp`** — Base `ASTNode` + one derived struct per grammar construct (`FieldNode`,
  `GroupNode`, `PageNode`, `ConditionalNode`, `ComputedFieldNode`, `ActionBlockNode`,
  `LayoutNode`, `VariableDeclNode`, `FormRootNode`). Nodes are dumb data containers; no logic
  lives here. Children owned via `std::unique_ptr<ASTNode>`.
- **`parser.hpp/cpp`** — `Parser` class. Token stream → `std::unique_ptr<FormRootNode>`. One
  private method per EBNF rule (`parseField()`, `parseGroup()`, etc.), mirroring the grammar
  directly. `peek()/advance()/expect()/synchronize()` helpers for control flow and error
  recovery.
- **`ast_visitor.hpp`** — Abstract `ASTVisitor` interface, one `visit()` per node type. Both
  `SemanticAnalyzer` and `JsonSerializer` implement this.
- **`semantic_analyzer.hpp/cpp`** — `SemanticAnalyzer : ASTVisitor`. Post-parse validation:
  duplicate field names, undefined references in conditionals/computed fields, type mismatches.
- **`json_serializer.hpp/cpp`** — `JsonSerializer : ASTVisitor`. AST → `nlohmann::json`. This
  JSON is exactly what the frontend consumes.
- **`forml_bridge.hpp/cpp`** — Single public API: `compileForml(source) -> JSON result`.
  Wires Lexer → Parser → SemanticAnalyzer → JsonSerializer end to end; the only entry point
  used by WASM bindings, the CLI, and tests.
- **`wasm/bindings.cpp`** — Emscripten `embind` bindings exposing `compileForml()` to JS.
- **`examples/main.cpp`** — Native CLI (`./forml_compiler myform.forml`) for fast local
  iteration without touching WASM/JS.
- **`tests/*`** — Per-stage unit tests against real `.forml` fixtures (valid and deliberately
  broken), read/verified by eye rather than a heavyweight test framework.

## Coding Conventions

- **C++ standard**: C++20 (consistent with the rest of Rishi's C++ work — smart pointers,
  `std::variant`, structured bindings, etc. are all fair game).
- **Ownership**: `std::unique_ptr` for AST tree ownership. No raw `new`/`delete`.
- **Error handling**: `DiagnosticEngine` collection pattern, not exceptions, for
  user-facing syntax/semantic errors (exceptions are reserved for genuine internal
  invariant violations, not malformed user input).
- **Naming**: `PascalCase` for types/classes, `camelCase` for functions/methods,
  `snake_case` for local variables, `SCREAMING_SNAKE_CASE` for enum values.
- **No parser generators.** Ever. Recursive descent, hand-written, full stop.
- **Comment density**: high. Every non-trivial function should explain *why*, not just
  restate the code in prose.
- **JSON library**: `nlohmann::json`, single header, vendored under `third_party/`.

## Grammar Source of Truth

The Forml EBNF grammar (v1.1, finalized) lives in the project's design docs — cross-reference
it directly when deriving `TokenType` values, AST node shapes, or parser rule structure.
Do not invent grammar constructs not present in the finalized EBNF; flag ambiguities back to
Rishi instead of guessing.

## Working Style for This Project

- Rishi is learning compiler construction alongside building this for real — prioritize
  clarity and heavy commenting over cleverness or brevity.
- Stop at stage boundaries and summarize what was built, any grammar ambiguities surfaced,
  and how to build/run it locally. Wait for explicit go-ahead before the next stage.
- No AI-sounding filler, no unnecessary hedging, no generic boilerplate — match the direct,
  technical tone of the rest of the Formix codebase and docs.