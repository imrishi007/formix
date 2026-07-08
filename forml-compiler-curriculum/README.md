# Forml Compiler Curriculum

A self-contained, hand-written, C++ recursive-descent parser for the **Forml DSL** — built from first principles with no parser generators.

---

## How to use this curriculum

Each file is a **standalone, compilable `.cpp`** paired with a `.md` explainer. Work through them in order. Every file builds on concepts from the previous one.

### Files 01–02 are complete and ready to run right now.

### Files 03–13 are scaffolded — they will be completed once you paste your Forml EBNF grammar.

---

## Compile and run (any file)

```bash
# One-time: confirm g++ is available
g++ --version

# Compile and run file 01
g++ -std=c++17 -Wall -o 01_tokens 01_tokens_and_lexing.cpp
./01_tokens      # Linux/Mac
01_tokens.exe    # Windows

# Same pattern for file 02
g++ -std=c++17 -Wall -o 02_lexer 02_lexer_class.cpp
./02_lexer
```

---

## Curriculum map

| File | Status | Topic |
|------|--------|-------|
| [01_tokens_and_lexing.cpp](01_tokens_and_lexing.cpp) | ✅ Complete | What is a token, char-by-char scanning, maximal munch, line/col tracking |
| [02_lexer_class.cpp](02_lexer_class.cpp) | ✅ Complete | Full Lexer class, `enum class TokenType`, keyword recognition, error collection |
| [03_grammars_and_ebnf.cpp](03_grammars_and_ebnf.cpp) | ⏸ Awaiting EBNF | CFGs, EBNF notation, grammar → C++ function mapping |
| [04_ast_design.cpp](04_ast_design.cpp) | ⏸ Awaiting EBNF | AST node classes, `unique_ptr` ownership, `NodeKind` enum |
| [05_recursive_descent_basics.cpp](05_recursive_descent_basics.cpp) | ⏸ Awaiting EBNF | `peek()`/`advance()`/`expect()`, one-rule parser |
| [06_recursive_descent_full.cpp](06_recursive_descent_full.cpp) | ⏸ Awaiting EBNF | Full Forml parser, mutual recursion, AST construction |
| [07_left_recursion_problem.cpp](07_left_recursion_problem.cpp) | ⏸ Awaiting EBNF | Spotting and eliminating left recursion |
| [08_operator_precedence.cpp](08_operator_precedence.cpp) | ⏸ Awaiting EBNF | Pratt parsing / precedence climbing for expressions |
| [09_error_handling_recovery.cpp](09_error_handling_recovery.cpp) | ⏸ Awaiting EBNF | Good error messages, panic-mode recovery, sync tokens |
| [10_visitor_pattern.cpp](10_visitor_pattern.cpp) | ✅ Runnable demo | Visitor pattern for multi-pass AST walking |
| [11_semantic_validation.cpp](11_semantic_validation.cpp) | ⏸ Awaiting EBNF | Symbol table, duplicate names, undefined refs |
| [12_json_serialization.cpp](12_json_serialization.cpp) | ⏸ Awaiting EBNF | `nlohmann/json`, `JsonVisitor`, output schema |
| [13_putting_it_together.cpp](13_putting_it_together.cpp) | ⏸ Awaiting EBNF | End-to-end pipeline: source → tokens → AST → JSON |

---

## The compiler pipeline

```
Forml source text
      │
      ▼
┌──────────────┐
│    Lexer     │  file 02  → vector<Token>
└──────────────┘
      │
      ▼
┌──────────────┐
│    Parser    │  files 05-09 → AST (ProgramNode)
└──────────────┘
      │
      ▼
┌──────────────────────┐
│  SemanticValidator   │  file 11 → validated AST (or errors)
└──────────────────────┘
      │
      ▼
┌──────────────┐
│  JsonVisitor │  files 10, 12 → JSON output
└──────────────┘
```

---

## Key conceptual milestones

| Milestone | File |
|-----------|------|
| "I understand what a token is" | 01 |
| "I can build a full lexer from scratch" | 02 |
| "I can read EBNF and map it to C++ functions" | 03 |
| "I know how to represent a parse tree in memory" | 04 |
| "I can write a working recursive-descent parser" | 05–06 |
| "I can handle operator precedence" | 07–08 |
| "My compiler gives good error messages" | 09 |
| "I can add new analysis passes without touching the AST" | 10 |
| "My compiler catches semantic errors" | 11 |
| "My compiler produces JSON output" | 12 |
| "I have a complete end-to-end compiler" | 13 |

---

## Next step

**Paste your Forml EBNF grammar** and files 03–13 will be completed with your real constructs: `field`, `page`, `group`, `conditional`, `computed`, `action`, etc.
