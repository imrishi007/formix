// =============================================================================
// 06_recursive_descent_full.cpp
// Forml Compiler Curriculum — File 06
//
// TOPIC: Scaling up to multiple mutually-recursive rules, building the full
//        AST while parsing, handling YOUR Forml's nested structures
//        (field/group/page nesting, conditional branches, action blocks).
//
// COMPILE: g++ -std=c++17 -Wall -o 06_rd_full 06_recursive_descent_full.cpp
// RUN:     ./06_rd_full
//
// ⚠️  STATUS: SCAFFOLD — full implementation awaits your Forml EBNF.
//
// This is the largest and most important file. It integrates:
//   • Lexer class (from file 02)
//   • AST node hierarchy (from file 04)
//   • Parser primitives (from file 05)
//   • All of YOUR actual Forml grammar rules
//
// After this file you will have a complete parser that turns Forml source
// text into a full in-memory AST.
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. MUTUAL RECURSION: How parsePageDecl() calls parseFieldDecl() which
//     might call parseExpression() which might call parsePrimary() which
//     might call parseGroupDecl()... and how C++ handles this naturally
//     because each rule is its own function.
//
//  2. BUILDING THE AST while parsing:
//     Each parse function now RETURNS a unique_ptr<SomeNode> instead of void.
//     The parent function takes ownership of the child's result.
//
//     Pattern:
//       NodePtr parseFieldDecl() {
//           auto tok = expect(TokenType::KwField, "'field'");
//           auto name = expect(TokenType::Identifier, "field name");
//           // ...
//           return std::make_unique<FieldNode>(name.text, ...);
//       }
//
//  3. NESTING: '{' ... '}' blocks are handled with:
//       expect(TokenType::LBrace, "'{'");
//       while (!check(TokenType::RBrace) && !isAtEnd()) {
//           children.push_back(parseSomething());
//       }
//       expect(TokenType::RBrace, "'}'");
//
//  4. YOUR FORML'S SPECIFIC CONSTRUCTS:
//     [PLACEHOLDER — each of the following will be a full parseXxx() function:]
//       - parsePageDecl()       — 'page' STRING '{' declarations '}'
//       - parseFieldDecl()      — 'field' NAME ':' TYPE options?
//       - parseGroupDecl()      — 'group' STRING '{' declarations '}'
//       - parseConditional()    — 'if' '(' expr ')' '{' ... '}' ('else' '{' ... '}')?
//       - parseComputedField()  — 'computed' NAME ':' expr
//       - parseActionBlock()    — 'action' STRING '{' statements '}'
//       - parseExpression()     — arithmetic/boolean expression (see file 08)
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <memory>

int main() {
    std::cout << "File 06 — Full Recursive Descent Parser\n\n";
    std::cout << "Key concept: mutual recursion\n";
    std::cout << "  parsePage() calls parseDeclaration()\n";
    std::cout << "  parseDeclaration() calls parseField() or parseGroup()\n";
    std::cout << "  parseGroup() calls parseDeclaration() again\n";
    std::cout << "  → C++ handles this naturally; each rule is a function\n\n";
    std::cout << "[Full implementation awaits your Forml EBNF.]\n";
    return 0;
}
