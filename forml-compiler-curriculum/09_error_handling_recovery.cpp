// =============================================================================
// 09_error_handling_recovery.cpp
// Forml Compiler Curriculum — File 09
//
// TOPIC: Reporting good error messages with line/col. Panic-mode recovery.
//        Synchronising at statement boundaries so parsing continues after an
//        error and the user gets ALL errors at once.
//
// COMPILE: g++ -std=c++17 -Wall -o 09_errors 09_error_handling_recovery.cpp
// RUN:     ./09_errors
//
// ⚠️  STATUS: SCAFFOLD — synchronisation tokens will come from your grammar.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. WHY error messages need line/col:
//       "Syntax error" tells the user nothing.
//       "Syntax error at line 7, column 12: expected ':' after field name" tells
//       them exactly where to look. We've been tracking line/col since file 01.
//
//  2. WHY one-error-at-a-time is bad:
//       If the parser throws on the FIRST error, the user gets one message,
//       fixes it, recompiles, gets another. That's 10 compile cycles for 10 errors.
//       Real compilers collect multiple errors per run.
//
//  3. PANIC-MODE RECOVERY — the standard algorithm:
//       When you encounter an unexpected token:
//         a) Record the error
//         b) SKIP tokens until you reach a "synchronisation point"
//            (a token that reliably starts a new statement/declaration)
//         c) Continue parsing from there
//
//       Synchronisation points for Forml:
//         [PLACEHOLDER: Will be the tokens that start your top-level declarations.
//          Likely: KwPage, KwField, KwGroup, KwAction, RBrace, Eof]
//
//  4. The ERROR NODE pattern:
//       Instead of returning nullptr when parsing fails, return a special
//       ErrorNode that the rest of the pipeline treats as a "skip me" node.
//       This lets later passes (validation, serialisation) continue on
//       the rest of the valid AST.
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <set>

// Error record — richer than just a string
struct CompilerError {
    int         line;
    int         col;
    std::string message;
    std::string context;   // the rule/function that generated this error

    void print() const {
        std::cerr << "error[" << line << ":" << col << "]: " << message;
        if (!context.empty()) std::cerr << "  (in " << context << ")";
        std::cerr << "\n";
    }
};

// =============================================================================
// SECTION 1 — Panic-mode recovery skeleton
// =============================================================================
//
//  The synchronise() function skips tokens until it finds one that can
//  START a new declaration — a "safe restart" point.
//
//  [PLACEHOLDER: The set of synchronisation tokens will be defined from
//   your grammar's top-level declaration starters.]
//
//  General pattern:
//
//    void synchronise() {
//        static const std::set<TokenType> syncTokens = {
//            TokenType::KwPage,
//            TokenType::KwField,
//            TokenType::KwGroup,
//            TokenType::RBrace,
//            TokenType::Eof,
//        };
//
//        advance(); // skip the bad token
//        while (!isAtEnd()) {
//            if (syncTokens.count(peekType())) return; // found a safe point
//            advance();
//        }
//    }
//
//  In the grammar rule functions, catch ParseError, call synchronise(), then
//  continue the outer parsing loop:
//
//    while (!isAtEnd()) {
//        try {
//            declarations.push_back(parseDeclaration());
//        } catch (const ParseError& e) {
//            errors_.push_back({e.line, e.col, e.message, "parseDeclaration"});
//            synchronise(); // skip to next safe restart point
//        }
//    }

// =============================================================================
// SECTION 2 — Good error message formatting
// =============================================================================
//
//  A good error message has three parts:
//    1. WHERE:   line:col  (always)
//    2. WHAT:    what was found (the actual bad token)
//    3. EXPECT:  what was expected instead
//
//  Template: "error[7:12]: expected ':' after field name, found 'type'"
//
//  Forml-specific helpful additions:
//    - For unknown field types: "unknown type 'phoen' — did you mean 'phone'?"
//      (Levenshtein distance suggestion — an exercise in file 11)
//    - For missing '}': "unclosed '{' opened at line 3:1"
//      (track open brace positions in a stack)

int main() {
    std::cout << "File 09 — Error Handling and Recovery\n\n";

    // Demonstrate the error record structure
    std::vector<CompilerError> errors = {
        {3,  5,  "expected ':' after field name, found 'type'", "parseFieldDecl"},
        {7,  1,  "unknown type 'phoen'", "parseFieldType"},
        {12, 3,  "unexpected '}' — no matching '{'", "parseDeclaration"},
    };

    std::cout << "=== Example error output ===\n";
    for (const auto& e : errors) e.print();

    std::cout << "\nPanic-mode recovery algorithm:\n";
    std::cout << "  1. Record the error\n";
    std::cout << "  2. Skip tokens until a 'sync token' is found\n";
    std::cout << "  3. Resume parsing — may find more errors in the same run\n\n";

    std::cout << "[Sync token set for Forml will be defined from your grammar.]\n";
    return 0;
}
