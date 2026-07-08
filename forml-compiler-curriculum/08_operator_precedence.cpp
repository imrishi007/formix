// =============================================================================
// 08_operator_precedence.cpp
// Forml Compiler Curriculum — File 08
//
// TOPIC: Precedence climbing / Pratt parsing for Forml's computed-field
//        expression language. Only needed if your grammar has binary operators
//        with different precedence levels.
//
// COMPILE: g++ -std=c++17 -Wall -o 08_prec 08_operator_precedence.cpp
// RUN:     ./08_prec
//
// ⚠️  STATUS: SCAFFOLD — operator table and expression grammar depend on
//              YOUR computed-field expression syntax.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  Precedence problem: given  2 + 3 * 4
//  Should the tree be  (2 + 3) * 4 = 20   or   2 + (3 * 4) = 14?
//
//  Math says 14 (multiplication binds tighter = higher precedence).
//  How does the PARSER enforce this?
//
//  OPTION A — Explicit precedence hierarchy (traditional recursive descent):
//    parseAddition()     { calls parseMultiplication() }
//    parseMultiplication { calls parseUnary() }
//    parseUnary()        { calls parsePrimary() }
//
//  One function per precedence level. Simple and readable, but requires
//  touching MANY functions to add a new operator.
//
//  OPTION B — Pratt / Precedence Climbing (one loop, operator table):
//    Give each operator a numeric "binding power" (precedence level).
//    One function parseExpression(minPower) does it all:
//
//      NodePtr parseExpression(int minPower = 0) {
//          auto left = parsePrimary();
//          while (operatorPrecedence(peek()) > minPower) {
//              int prec = operatorPrecedence(advance());
//              auto right = parseExpression(prec);   // recurse for right side
//              left = makeBinaryNode(op, left, right);
//          }
//          return left;
//      }
//
//  Pratt is more elegant once you have many operators. For Forml, we'll
//  decide which approach fits best once we see your expression grammar.
//
// ── FORML-SPECIFIC QUESTIONS ──────────────────────────────────────────────────
//
//  [PLACEHOLDER: After you paste your EBNF, this file will answer:
//    1. What operators does Forml's computed-field expression have?
//       (arithmetic +,-,*,/? comparisons ==,!=,<,>? logical &&,||? ternary ?:?)
//    2. What are the precedence levels?
//    3. Which operators are left-associative vs right-associative?
//       (Right-associative: a = b = c should parse as a = (b = c))
//    4. Is Option A or Option B better for Forml's expression complexity?]
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <unordered_map>

// =============================================================================
// SECTION 1 — Pratt parser skeleton (generic, not Forml-specific yet)
// =============================================================================
//
//  The key data structure: a precedence table mapping operator token types
//  to their binding power (precedence level).
//
//  Higher number = binds tighter (evaluated first).
//
//  [PLACEHOLDER: This table will be populated from your grammar's operators]
//
//  Example structure (generic):
//    Precedence level 1:  ||  (logical or)       — lowest
//    Precedence level 2:  &&  (logical and)
//    Precedence level 3:  == !=  (equality)
//    Precedence level 4:  < > <= >=  (comparison)
//    Precedence level 5:  + -  (addition)
//    Precedence level 6:  * / %  (multiplication) — highest binary
//    Unary:               ! -  (right side, no left operand)

// Associativity tells us: same-precedence operators, left or right binding?
//   Left:  1 + 2 + 3  →  (1 + 2) + 3
//   Right: a = b = 1  →  a = (b = 1)
enum class Assoc { Left, Right };

struct OpInfo {
    int   precedence;
    Assoc assoc;
};

// In the real implementation this will contain Forml's actual operators
// [PLACEHOLDER]
std::unordered_map<std::string, OpInfo> buildOperatorTable() {
    return {
        {"||", {1, Assoc::Left}},
        {"&&", {2, Assoc::Left}},
        {"==", {3, Assoc::Left}},
        {"!=", {3, Assoc::Left}},
        {"<",  {4, Assoc::Left}},
        {">",  {4, Assoc::Left}},
        {"<=", {4, Assoc::Left}},
        {">=", {4, Assoc::Left}},
        {"+",  {5, Assoc::Left}},
        {"-",  {5, Assoc::Left}},
        {"*",  {6, Assoc::Left}},
        {"/",  {6, Assoc::Left}},
        {"%",  {6, Assoc::Left}},
    };
}

int main() {
    auto ops = buildOperatorTable();

    std::cout << "File 08 — Operator Precedence\n\n";
    std::cout << "Operator precedence table (higher = binds tighter):\n";
    for (const auto& [op, info] : ops) {
        std::cout << "  " << op << "  →  precedence=" << info.precedence
                  << "  " << (info.assoc == Assoc::Left ? "left" : "right")
                  << "-associative\n";
    }
    std::cout << "\n";
    std::cout << "Example: 2 + 3 * 4\n";
    std::cout << "  '*' has precedence 6, '+' has precedence 5\n";
    std::cout << "  Parser sees '+', then finds '*' with HIGHER precedence\n";
    std::cout << "  → right side is parsed as (3 * 4) first → tree: 2 + (3*4) = 14\n\n";
    std::cout << "[Forml's expression operators will be filled in from your EBNF.]\n";
    return 0;
}
