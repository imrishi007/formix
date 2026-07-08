# 02 — The Lexer Class

## What you'll learn

How to wrap the raw scanning logic from file 01 into a proper **class** with private state, a clean public API, keyword recognition, and error collection.

---

## Why a class?

The free-function scanner from file 01 works fine but has a problem: all state lives on the stack of one function. In a real compiler:

- The parser may want to **restart** the lexer at a checkpoint
- The IDE language server may run the lexer **incrementally** as you type
- Error messages must be **collected**, not thrown one at a time

A class lets you model all of this cleanly.

---

## `enum class TokenType` — why not plain ints?

File 01 used `const int TOK_WORD = 1`. The compiler accepts `tok.kind == 42` without complaint. `enum class` fixes this:

```cpp
// This does NOT compile — the compiler catches the typo:
if (tok.type == 42) { }              // ❌ int vs TokenType

// This compiles, and the name is self-documenting:
if (tok.type == TokenType::KwPage) { }  // ✅
```

Every comparison is fully qualified, so you can never mix up two different enum types by accident.

---

## Keyword recognition — scan first, classify second

A keyword like `page` looks exactly like an identifier during the character-scanning phase. Rather than special-casing each keyword in the scanner loop, we:

1. Scan any word (letters/digits/underscores) as if it were an identifier
2. Look the text up in a **static hash map**
3. Replace the type with the keyword type if found, otherwise keep `Identifier`

```cpp
auto it = keywords().find(text);
TokenType type = (it != kw.end()) ? it->second : TokenType::Identifier;
```

This pattern scales to hundreds of keywords without changing the scanning loop.

---

## Two-character operators: the `match()` trick

For `->`, `==`, `!=`, `<=`, `>=` we need one-character lookahead *with* conditional consumption:

```cpp
bool match(char expected) {
    if (source_[pos_] != expected) return false;
    advance();   // consume only if it matches
    return true;
}

// In the switch:
case '=': {
    if (match('=')) return makeToken(TokenType::EqEq, "==");
    return makeToken(TokenType::Equals, "=");
}
```

`match()` is maximal munch expressed as a method.

---

## Error collection vs. throwing

| Strategy | Effect |
|----------|--------|
| `throw` on first error | User gets one error message per compile run |
| Collect into `errors_` | User gets all errors at once |

We push error messages into `std::vector<std::string> errors_` and return an `Error` token so the parser can continue. After `tokenize()` returns, the caller checks `lexer.hasErrors()`.

---

## Class API summary

```cpp
// Construction
Lexer lexer(sourceString);

// Tokenise the entire input
std::vector<Token> tokens = lexer.tokenize();

// Check for errors afterward
if (lexer.hasErrors()) {
    for (const auto& msg : lexer.errors()) { ... }
}
```

That's the **entire public interface** the parser will use.

---

## Token anatomy (upgraded)

```
Token {
    TokenType   type;   // strong-typed enum (not int)
    std::string text;   // exact source characters (decoded for strings)
    int         line;   // 1-indexed
    int         col;    // 1-indexed
}
```

For string literals, `text` holds the **decoded** value — `"\n"` in source becomes a real newline in `text`. This is important for serialisation later.

---

## What's next?

File 03 introduces **context-free grammars and EBNF** — the formal notation that describes what _sequences_ of tokens are legal. This is where your actual Forml grammar enters the picture.

> ⏸ **You'll be asked to paste your EBNF before file 03 is written in detail.**
