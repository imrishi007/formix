# 01 — Tokens and Lexing

## What you'll learn

How a compiler turns a raw string of characters into a structured list of **tokens** — the smallest meaningful units of a programming language.

---

## The core idea: a token is a labelled chunk

Given this Forml source:

```
page "Contact Us" { field name: text }
```

A human reads this as *"a page called Contact Us containing a field"*. Your program sees a flat stream of 36 characters. Before you can build a tree, you need to cut that stream into pieces the rest of the compiler can reason about.

A **token** is a pair: **(KIND, TEXT)**. KIND is a category tag; TEXT is the exact source characters.

| Kind | Text |
|------|------|
| WORD | `page` |
| STRING | `Contact Us` |
| LBRACE | `{` |
| WORD | `field` |
| WORD | `name` |
| COLON | `:` |
| WORD | `text` |
| RBRACE | `}` |
| EOF | _(empty)_ |

Notice: whitespace and comments don't appear in this table. The lexer *discards* them.

---

## Key concepts in the code

### The cursor pattern

```cpp
int pos  = 0;   // next character to read
int line = 1;   // current source line (for error messages)
int col  = 1;   // current column
```

`peek()` looks at `source[pos]` without moving. `advance()` reads it *and* moves `pos` forward, updating `line`/`col`.

### Maximal munch

When you see `name:`, should you emit `"na"` then `"me"` then `":"`? No. The rule is: **consume the longest possible valid token**. So you keep consuming letters until you hit a non-letter, giving you `"name"` as one WORD token. Then `:` starts a fresh token of kind COLON.

This is why `!=` is one operator token, not `!` followed by `=`.

### Line tracking

Every time `advance()` sees `'\n'`, it increments `line` and resets `col` to 1. Since `advance()` is the only place characters are consumed, this stays accurate automatically — there's no separate line-counting pass.

---

## Expected output

```
=== Tokens ===
[WORD   | "page"       | line=2 col=1]
[STRING | "Contact Us" | line=2 col=6]
[LBRACE | "{"          | line=2 col=19]
[WORD   | "field"      | line=3 col=5]
[WORD   | "name"       | line=3 col=11]
[COLON  | ":"          | line=3 col=15]
[WORD   | "text"       | line=3 col=17]
[WORD   | "field"      | line=4 col=5]
...
[EOF    | ""           | ...]
```

---

## Vocabulary

| Term | Meaning |
|------|---------|
| **Lexer / tokenizer / scanner** | All three words mean the same thing: the component that turns source text into tokens |
| **Token** | A (kind, text, position) triple |
| **Maximal munch** | Always consume the *longest* possible token |
| **EOF token** | A sentinel token appended at the end so the parser never reads off the edge |
| **peek()** | Look at the current char without consuming it |
| **advance()** | Consume the current char and move the cursor |

---

## Where this fits in the pipeline

```
Source string
     │
     ▼
┌─────────┐
│  Lexer  │  ◄── you are here
└─────────┘
     │  vector<Token>
     ▼
┌─────────┐
│  Parser │  (file 05+)
└─────────┘
     │  AST
     ▼
┌──────────────┐
│  Validation  │  (file 11)
└──────────────┘
     │
     ▼
┌──────────────┐
│  JSON output │  (file 12)
└──────────────┘
```
