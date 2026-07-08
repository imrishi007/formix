// =============================================================================
// 05_recursive_descent_basics.cpp
// Forml Compiler Curriculum — File 05
//
// TOPIC: One function per grammar rule. The peek()/advance()/expect() helper
//        trio. Parsing a small one-rule grammar end to end.
//
// COMPILE: g++ -std=c++17 -Wall -o 05_rd_basics 05_recursive_descent_basics.cpp
// RUN:     ./05_rd_basics
//
// ⚠️  STATUS: SCAFFOLD — will use your Forml grammar rules after EBNF is provided.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. The Parser class structure:
//       - Holds the vector<Token> from the Lexer
//       - Has a current_ index pointing at the "next token to consume"
//
//  2. The three fundamental parser helpers:
//
//       peek()    — return current token WITHOUT consuming it
//                   (used in every if/while for grammar branching)
//
//       advance() — return current token AND move current_ forward
//                   (consumes a token; you call this when you're sure
//                    you want that token)
//
//       expect(type) — assert that the current token is of type 'type',
//                      consume it, and return it; or throw a parse error.
//                      (used for required tokens like '{', ':', keywords)
//
//  3. Parsing a one-rule grammar (a trimmed Forml rule) end to end:
//
//       [PLACEHOLDER: will use the simplest self-contained rule from your grammar]
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <stdexcept>

// ── Include the Lexer from file 02 ────────────────────────────────────────────
// In a real project these would be separate .h / .cpp files.
// For curriculum purposes each file is standalone — so we paste
// the minimum needed types here.

// [For brevity: TokenType, Token, Lexer abbreviated — see file 02 for full versions]

enum class TokenType {
    Identifier, StringLit, IntLit, FloatLit,
    KwPage, KwField, KwGroup, KwAction, KwIf, KwElse,
    KwComputed, KwRequired, KwOptional, KwTrue, KwFalse,
    LBrace, RBrace, LParen, RParen, LBracket, RBracket,
    Colon, Comma, Semicolon, Dot, Arrow,
    Equals, EqEq, BangEq, Bang, Lt, Gt, LtEq, GtEq,
    Plus, Minus, Star, Slash, Percent, Pipe, Ampersand,
    Question, At, Eof, Error,
};

struct Token {
    TokenType   type;
    std::string text;
    int         line;
    int         col;
};

// ── ParseError: a typed exception for parse failures ─────────────────────────
//
//  WHY a custom exception rather than just std::runtime_error?
//  Because callers (in error recovery, file 09) can catch ParseError
//  specifically and distinguish it from unexpected C++ errors.

class ParseError : public std::exception {
public:
    std::string message;
    int line, col;

    ParseError(std::string msg, int line, int col)
        : message(std::move(msg)), line(line), col(col) {}

    const char* what() const noexcept override { return message.c_str(); }
};

// =============================================================================
// SECTION 1 — The Parser class skeleton
// =============================================================================
//
//  The Parser's job: turn vector<Token> into an AST.
//  It does this by implementing one C++ function per grammar rule.

class Parser {
public:
    explicit Parser(std::vector<Token> tokens)
        : tokens_(std::move(tokens))
        , current_(0)           // start at token 0
    {}

    // The public entry point: parse the whole program.
    // Returns nothing for now (AST construction is file 05+).
    // For this file we just PRINT what we're parsing to prove it works.
    void parse() {
        parseProgram();
        if (!isAtEnd()) {
            // Tokens left over after parsing — unexpected trailing content
            const Token& t = peek();
            throw ParseError("Unexpected token '" + t.text + "' after program end",
                             t.line, t.col);
        }
    }

private:
    std::vector<Token> tokens_;
    int                current_;   // index of the NEXT token to consume

    // ══════════════════════════════════════════════════════════════════════
    //  The Three Primitives — MEMORISE THESE
    // ══════════════════════════════════════════════════════════════════════

    // peek() — look at the current token WITHOUT consuming it.
    // Returns the current token. If we're past the end, returns the EOF token.
    const Token& peek() const {
        // The last token is always EOF (the Lexer guarantees this).
        // We return it if current_ somehow went past the end.
        return tokens_[current_];
    }

    // peekType() — convenience: just the type of the current token.
    // Used constantly in if/while conditions.
    TokenType peekType() const {
        return tokens_[current_].type;
    }

    // advance() — consume current token and move forward.
    // Returns the token that was consumed (useful for capturing its text).
    const Token& advance() {
        if (!isAtEnd()) current_++;
        return tokens_[current_ - 1]; // return the token we just passed
    }

    // expect(type) — like advance() but with a TYPE CHECK.
    // If the current token is not of the expected type, throw ParseError.
    // This is the "asserting consume" — use when a token is REQUIRED.
    const Token& expect(TokenType type, const std::string& description) {
        if (peekType() == type) {
            return advance();
        }
        const Token& t = peek();
        throw ParseError("Expected " + description + " but got '" + t.text + "'",
                         t.line, t.col);
    }

    // check(type) — true if current token is of given type, WITHOUT consuming.
    // Used in if() and while() guards before deciding whether to call a sub-rule.
    bool check(TokenType type) const {
        return peekType() == type;
    }

    // matchAny(type) — if current token matches, consume and return true.
    // A shorthand for:  if (check(t)) { advance(); return true; }
    bool matchAny(TokenType type) {
        if (check(type)) { advance(); return true; }
        return false;
    }

    // isAtEnd() — true if we've consumed all tokens (current points at EOF).
    bool isAtEnd() const {
        return tokens_[current_].type == TokenType::Eof;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Grammar rule functions
    // ══════════════════════════════════════════════════════════════════════
    //
    //  [PLACEHOLDER: These will implement your actual Forml grammar rules.
    //
    //  The structure below shows the PATTERN. After you paste your EBNF,
    //  each rule function will reference real Forml constructs.
    //
    //  Pattern example (generic):
    //
    //    // EBNF: Program → Declaration*
    //    void parseProgram() {
    //        while (!isAtEnd()) {
    //            parseDeclaration();
    //        }
    //    }
    //
    //    // EBNF: Declaration → PageDecl | FieldDecl
    //    void parseDeclaration() {
    //        if (check(TokenType::KwPage)) {
    //            parsePageDecl();
    //        } else if (check(TokenType::KwField)) {
    //            parseFieldDecl();
    //        } else {
    //            const Token& t = peek();
    //            throw ParseError("Expected declaration", t.line, t.col);
    //        }
    //    }
    //
    //    // EBNF: PageDecl → 'page' STRING '{' Declaration* '}'
    //    void parsePageDecl() {
    //        expect(TokenType::KwPage, "'page'");
    //        Token label = expect(TokenType::StringLit, "page label string");
    //        expect(TokenType::LBrace, "'{'");
    //        while (!check(TokenType::RBrace) && !isAtEnd()) {
    //            parseDeclaration();
    //        }
    //        expect(TokenType::RBrace, "'}'");
    //        std::cout << "Parsed page: \"" << label.text << "\"\n";
    //    }
    //  ]

    // Minimal placeholder implementation so the file compiles
    void parseProgram() {
        std::cout << "[parseProgram] — will parse your Forml declarations here\n";
        // In real implementation: while (!isAtEnd()) parseDeclaration();
        // For now, just consume all non-EOF tokens
        while (!isAtEnd()) {
            const Token& t = advance();
            std::cout << "  consumed: " << t.text << "\n";
        }
    }
};

// =============================================================================
// SECTION 2 — main(): show the primitive trio in isolation
// =============================================================================

int main() {
    std::cout << "=== File 05: Recursive Descent Basics ===\n\n";

    std::cout << "The three parser primitives:\n";
    std::cout << "  peek()          — look at current token, don't consume\n";
    std::cout << "  advance()       — consume and return current token\n";
    std::cout << "  expect(T,desc)  — consume if matches T, else throw ParseError\n\n";

    std::cout << "The EBNF → function mapping:\n";
    std::cout << "  A B C    →  parse_A(); parse_B(); parse_C();\n";
    std::cout << "  A | B    →  if (check(A)) parse_A(); else parse_B();\n";
    std::cout << "  A?       →  if (check(A)) parse_A();\n";
    std::cout << "  A*       →  while (check(A)) parse_A();\n";
    std::cout << "  A+       →  parse_A(); while (check(A)) parse_A();\n\n";

    std::cout << "[Full worked example will be added from your Forml grammar.]\n";
    return 0;
}

// =============================================================================
// TRY THIS — [to be written after grammar is provided]
// =============================================================================
