// =============================================================================
// 03_grammars_and_ebnf.cpp
// Forml Compiler Curriculum — File 03
//
// TOPIC: Context-Free Grammars, EBNF notation, and how grammar rules map
//        directly to C++ recursive-descent parsing functions.
//
// COMPILE: g++ -std=c++17 -Wall -o 03_grammars 03_grammars_and_ebnf.cpp
// RUN:     ./03_grammars
//
// ⚠️  STATUS: SCAFFOLD — awaiting your Forml EBNF grammar.
//
// This file will be completed once you paste your grammar. The structure,
// comments, and pedagogical framing are all here. The grammar-specific
// content (Forml rules, worked examples) will be filled in with YOUR
// actual constructs: field, page, group, conditional, computed, action, etc.
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. What a Context-Free Grammar (CFG) is and why it's the right tool
//     for describing programming language syntax
//
//  2. EBNF notation in full:
//       sequence:    A B C           (A then B then C)
//       alternation: A | B           (A or B)
//       option:      A?              (zero or one A)
//       repetition:  A*              (zero or more A)
//       repetition+: A+              (one or more A)
//       grouping:    ( A | B ) C     (group then sequence)
//       literal:     "page"          (exact keyword token)
//       nonterminal: FieldDecl       (another rule — CAPITALISED by convention)
//
//  3. The KEY insight: every EBNF rule maps to exactly ONE C++ function.
//     You don't need to invent a mapping — it follows mechanically.
//
//  4. A worked example using YOUR Forml grammar to show the mapping concretely.
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>

// =============================================================================
// SECTION 1 — What is a Grammar?
// =============================================================================
//
//  A grammar is a set of RULES that say which sequences of tokens are legal.
//  Each rule has:
//    • a name (the "nonterminal")
//    • a body (what sequence of tokens/other-rules it expands into)
//
//  Example: a tiny grammar for arithmetic expressions
//
//    Expr   → Term ( ('+' | '-') Term )*
//    Term   → Factor ( ('*' | '/') Factor )*
//    Factor → NUMBER | '(' Expr ')'
//
//  Reading this: "An expression is a term, followed by zero or more
//  occurrences of (an operator and another term)."
//
//  The grammar is RECURSIVE: Expr calls Term, Term calls Factor, Factor
//  optionally calls Expr. This is what enables nested expressions like
//  (1 + (2 * 3)).
//
// ── YOUR FORML GRAMMAR GOES HERE ─────────────────────────────────────────────
//
//  [PLACEHOLDER: Once you paste your EBNF, this section will walk through
//   each rule — Page, Field, Group, Conditional, Computed, Action, etc. —
//   and show exactly how each one maps to a parsing function.]
//
// =============================================================================

// =============================================================================
// SECTION 2 — EBNF → C++ Mapping Table
// =============================================================================
//
//  This table is the most important thing in the entire curriculum.
//  Memorise it. Every file after this uses it.
//
//  EBNF construct         C++ code shape
//  ─────────────────────  ───────────────────────────────────────────────────
//  A B C                  parse_A(); parse_B(); parse_C();
//  A | B                  if (peek == A) { parse_A(); } else { parse_B(); }
//  A?                     if (peek == A) { parse_A(); }
//  A*                     while (peek == A) { parse_A(); }
//  A+                     parse_A(); while (peek == A) { parse_A(); }
//  "keyword"              expect(TokenType::KwKeyword);
//  IDENTIFIER              expect(TokenType::Identifier);
//  ( A | B ) C            [handle the group inline, then parse C]
//
//  The 'peek' in the table above means "look at the current token's type
//  without consuming it" — implemented by the parser's peek() method (file 05).
//
// =============================================================================

// =============================================================================
// SECTION 3 — Worked example: YOUR Forml grammar
// =============================================================================
//
//  [PLACEHOLDER: This section will show your actual grammar rules, then the
//   corresponding C++ parsing function stubs side-by-side. For example:
//
//   EBNF rule:
//       FieldDecl → 'field' IDENTIFIER ':' FieldType FieldOptions?
//
//   C++ function stub:
//       FieldDeclNode* parseFieldDecl() {
//           expect(TokenType::KwField);
//           Token name = expect(TokenType::Identifier);
//           expect(TokenType::Colon);
//           auto type = parseFieldType();
//           std::unique_ptr<FieldOptionsNode> opts;
//           if (peek().type != TokenType::RBrace) {
//               opts = parseFieldOptions();
//           }
//           return new FieldDeclNode(name, std::move(type), std::move(opts));
//       }
//
//   This mapping is mechanical. There is no artistry here — the grammar
//   tells you exactly what to write. ]
//
// =============================================================================

// =============================================================================
// SECTION 4 — Runnable demonstration
// =============================================================================
//
//  [PLACEHOLDER: This section will contain a compilable demo that:
//   1. Uses the Lexer from file 02 to tokenise a sample Forml snippet
//   2. Pretty-prints the token stream
//   3. Annotates which grammar rule each token "belongs to"
//   The goal is to make the grammar/token relationship visceral and visual.]

int main() {
    std::cout << "File 03 — Grammar and EBNF\n\n";

    std::cout << "EBNF → C++ mapping cheat sheet:\n";
    std::cout << "  A B C           →  parse_A(); parse_B(); parse_C();\n";
    std::cout << "  A | B           →  if (...) parse_A(); else parse_B();\n";
    std::cout << "  A?              →  if (...) parse_A();\n";
    std::cout << "  A*              →  while (...) parse_A();\n";
    std::cout << "  A+              →  parse_A(); while (...) parse_A();\n";
    std::cout << "  \"keyword\"     →  expect(TokenType::KwKeyword);\n\n";

    std::cout << "[This file will be completed after you paste your Forml EBNF.]\n";
    return 0;
}

// =============================================================================
// TRY THIS — [to be written after grammar is provided]
// =============================================================================
