// =============================================================================
// 07_left_recursion_problem.cpp
// Forml Compiler Curriculum — File 07
//
// TOPIC: Why left recursion breaks recursive descent. How to spot it.
//        How to rewrite grammar rules to eliminate it. Whether Forml has it.
//
// COMPILE: g++ -std=c++17 -Wall -o 07_left_rec 07_left_recursion_problem.cpp
// RUN:     ./07_left_rec
//
// ⚠️  STATUS: SCAFFOLD — examples will use expressions from YOUR grammar.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  Left recursion: a grammar rule where the rule's own name appears as the
//  FIRST symbol of its own body.
//
//  Example of a BROKEN rule:
//    Expr → Expr '+' Term
//           ↑
//           left-recursive: Expr calls itself IMMEDIATELY as its first action
//
//  What happens in recursive descent?
//    parseExpr() calls parseExpr() calls parseExpr() calls...
//    INFINITE LOOP → stack overflow.
//
//  The fix is ALWAYS the same mechanical transformation:
//
//  Left-recursive:                     Equivalent right-recursive + loop:
//  ─────────────────────────           ─────────────────────────────────
//  A → A α | β                         A → β ( α )*
//
//  In code:
//    // BAD:
//    NodePtr parseA() { return parseA(); }  // infinite recursion
//
//    // GOOD (iterative):
//    NodePtr parseA() {
//        auto node = parseB();  // parse β
//        while (peekIsAlpha()) {
//            consume α;
//            node = combine(node, parseB());
//        }
//        return node;
//    }
//
//  Does FORML have left recursion?
//    [PLACEHOLDER: Once you paste your grammar, this file will:
//     1. Scan all rules for left-recursive patterns
//     2. Show which ones (if any) need rewriting
//     3. Demonstrate the transformation with your actual rules]
//
// =============================================================================

#include <iostream>

// =============================================================================
// SECTION 1 — Demonstrating the problem with a concrete broken parser
// =============================================================================
//
//  [PLACEHOLDER: This section will have a COMPILABLE demonstration of:
//   1. A grammar that IS left-recursive (the while-loop-based "fixed" version
//      side-by-side with a note about what the broken version looks like)
//   2. Your specific Forml expression rules if they need this treatment]

// =============================================================================
// SECTION 2 — The mechanical rewrite algorithm
// =============================================================================
//
//  The following grammar:
//    A → A 'op' B    ← left-recursive
//      | B
//
//  Is mechanically rewritten to:
//    A  → B A'
//    A' → 'op' B A'  ← right-recursive (works with recursive descent!)
//       | ε           ← or empty
//
//  OR equivalently (and more readably in code) using an iterative loop:
//    NodePtr parseA() {
//        auto node = parseB();
//        while (peek() is 'op') {
//            consume 'op';
//            auto right = parseB();
//            node = makeOpNode(node, right);  // left-associative by default
//        }
//        return node;
//    }
//
//  This loop produces a LEFT-ASSOCIATIVE tree, which is what you want for
//  arithmetic: 1 + 2 + 3 = (1 + 2) + 3, not 1 + (2 + 3).

int main() {
    std::cout << "File 07 — Left Recursion Problem\n\n";
    std::cout << "The infinite recursion trap:\n";
    std::cout << "  EBNF: Expr -> Expr '+' Term   ← left-recursive\n";
    std::cout << "  Code: parseExpr() calls parseExpr() immediately → stack overflow\n\n";

    std::cout << "The fix — convert to right-recursion + loop:\n";
    std::cout << "  EBNF: Expr -> Term ('+' Term)*\n";
    std::cout << "  Code: auto node = parseTerm();\n";
    std::cout << "        while (peek() == '+') { advance(); node = combine(node, parseTerm()); }\n\n";

    std::cout << "[Forml-specific left recursion analysis awaits your EBNF.]\n";
    return 0;
}

// =============================================================================
// TRY THIS — [to be written after grammar is provided]
// =============================================================================
